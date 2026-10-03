import * as fs from 'node:fs';
import * as zlib from 'node:zlib';

let CRC_TABLE: Int32Array | null = null;

function crc_table(): Int32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  CRC_TABLE = table;
  return table;
}

export function crc32(data: Buffer): number {
  const table = crc_table();
  let crc = -1;
  for (let index = 0; index < data.length; index += 1) {
    crc = (crc >>> 8) ^ table[(crc ^ data[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function dos_stamp(when: Date): { time: number; date: number } {
  const year = Math.max(1980, when.getFullYear());
  return {
    time: ((when.getHours() & 31) << 11) | ((when.getMinutes() & 63) << 5) | ((when.getSeconds() / 2) & 31),
    date: (((year - 1980) & 127) << 9) | (((when.getMonth() + 1) & 15) << 5) | (when.getDate() & 31),
  };
}

export interface ZipSource {
  /** the path stored inside the archive, always forward slashes */
  name: string;
  file: string;
  mtime: Date;
}

export interface ZipResult {
  entries: number;
  skipped: number;
  bytes: number;
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const UTF8_FLAG = 0x0800;

/** one file at a time stays in memory, the archive itself streams to disk,
    so bundling a large project never needs the whole thing resident */
export async function write_zip(out_file: string, sources: ZipSource[]): Promise<ZipResult> {
  const handle = await fs.promises.open(out_file, 'w');
  const central: Buffer[] = [];
  let offset = 0;
  let skipped = 0;

  const write_at = async (buffer: Buffer, position: number): Promise<void> => {
    await handle.write(buffer, 0, buffer.length, position);
  };

  try {
    for (const source of sources) {
      let data: Buffer;
      try {
        data = await fs.promises.readFile(source.file);
      } catch {
        skipped += 1;
        continue;
      }
      const crc = crc32(data);
      const deflated = zlib.deflateRawSync(data, { level: 6 });
      const packed = deflated.length < data.length ? deflated : data;
      const method = packed === data ? 0 : 8;
      const name = Buffer.from(source.name.replace(/\\/g, '/'), 'utf8');
      const stamp = dos_stamp(source.mtime);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(LOCAL_SIG, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(UTF8_FLAG, 6);
      local.writeUInt16LE(method, 8);
      local.writeUInt16LE(stamp.time, 10);
      local.writeUInt16LE(stamp.date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(packed.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);

      const header_offset = offset;
      await write_at(local, offset);
      await write_at(name, offset + local.length);
      await write_at(packed, offset + local.length + name.length);
      offset += local.length + name.length + packed.length;

      const record = Buffer.alloc(46);
      record.writeUInt32LE(CENTRAL_SIG, 0);
      record.writeUInt16LE(20, 4);
      record.writeUInt16LE(20, 6);
      record.writeUInt16LE(UTF8_FLAG, 8);
      record.writeUInt16LE(method, 10);
      record.writeUInt16LE(stamp.time, 12);
      record.writeUInt16LE(stamp.date, 14);
      record.writeUInt32LE(crc, 16);
      record.writeUInt32LE(packed.length, 20);
      record.writeUInt32LE(data.length, 24);
      record.writeUInt16LE(name.length, 28);
      record.writeUInt16LE(0, 30);
      record.writeUInt16LE(0, 32);
      record.writeUInt16LE(0, 34);
      record.writeUInt16LE(0, 36);
      record.writeUInt32LE(0, 38);
      record.writeUInt32LE(header_offset, 42);
      central.push(record, name);
    }

    const directory_offset = offset;
    let directory_size = 0;
    for (const record of central) {
      await write_at(record, offset);
      offset += record.length;
      directory_size += record.length;
    }

    const end = Buffer.alloc(22);
    end.writeUInt32LE(EOCD_SIG, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(central.length / 2, 8);
    end.writeUInt16LE(central.length / 2, 10);
    end.writeUInt32LE(directory_size, 12);
    end.writeUInt32LE(directory_offset, 16);
    end.writeUInt16LE(0, 20);
    await write_at(end, offset);

    const stat = await handle.stat();
    return { entries: central.length / 2, skipped, bytes: stat.size };
  } finally {
    await handle.close();
  }
}
