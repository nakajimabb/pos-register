import * as xlsx from 'xlsx';

export type FieldType = string | Date | number | boolean;
export type ValueMapping = { [key: string]: FieldType };
export type HeaderInfo = {
  label: string;
  name: string;
  asNumber?: boolean;
  zeroPadding?: number;
  mapping?: ValueMapping;
}[];

const readExcel = async (blob: File, number_as_string: boolean = false) => {
  return new Promise<{
    header: string[];
    data: FieldType[][];
  }>((resolve, reject) => {
    let header: string[] = [];
    const data: FieldType[][] = [];
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        var fileData = reader.result;
        var wb = xlsx.read(fileData, {
          type: 'binary',
          raw: true,
          cellDates: true,
        });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const range_a1 = sheet['!ref'];
        if (range_a1) {
          const range = xlsx.utils.decode_range(range_a1);
          for (let r = range.s.r; r <= range.e.r; r++) {
            const row: FieldType[] = [];
            for (let c = range.s.c; c <= range.e.c; c++) {
              const p = xlsx.utils.encode_cell({ c, r });
              const cell = sheet[p];
              const cell_type = cell?.t;
              if (cell_type === 'd') {
                row.push(cell.v as Date);
              } else if (cell_type === 'n') {
                if (number_as_string) {
                  row.push((cell.w || '').trim());
                } else {
                  row.push(cell.v as number);
                }
              } else {
                row.push(cell?.w || '');
              }
            }
            if (r === 0) {
              header = row.map((col) => String(col));
            } else {
              data.push(row);
            }
          }
          resolve({ header, data });
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsBinaryString(blob);
  });
};

export const readExcelAsOjects = async (blob: File, headerInfo: HeaderInfo, exactHeaderMatch = true) => {
  const { header, data } = await readExcel(blob, true);

  const names = new Map<number, string>();
  const asNumbers = new Set<number>();
  const zeroPaddings = new Map<number, number>();
  const mappings = new Map<number, ValueMapping>();
  headerInfo.forEach((col) => {
    const index = exactHeaderMatch
      ? header.indexOf(col.label)
      : header.findIndex((item) => item.indexOf(col.label) === 0);
    if (index >= 0) {
      names.set(index, col.name);
    } else {
      console.log(`error: not found column ${col.label}`);
    }
    if (col.asNumber) {
      asNumbers.add(index);
    }
    if (col.zeroPadding) {
      zeroPaddings.set(index, col.zeroPadding);
    }
    if (col.mapping) {
      mappings.set(index, col.mapping);
    }
  });

  return data.map((row) => {
    // 前処理
    mappings.forEach((mapping, index) => {
      const col = String(row[index]);
      row[index] = mapping[col];
    });
    zeroPaddings.forEach((padding, index) => {
      row[index] = String(row[index]).padStart(padding, '0');
    });
    asNumbers.forEach((index) => {
      row[index] = Number(row[index]);
    });
    // オブジェクトに変換
    const item: { [key: string]: FieldType } = {};
    names.forEach((name, key) => {
      item[name] = row[key];
    });
    return item;
  });
};

export default readExcel;
