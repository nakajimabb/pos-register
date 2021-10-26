import * as xlsx from 'xlsx';

const readExcel = async (blob: File, number_as_string: boolean = false) => {
  return new Promise<{
    header: string[];
    data: (string | Date | number)[][];
  }>((resolve, reject) => {
    let header: string[] = [];
    const data: (string | Date | number)[][] = [];
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
            const row: (string | Date | number)[] = [];
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

export type HeaderInfo = {
  label: string;
  name: string;
  string_as_number?: boolean;
}[];

export const readExcelAsOjects = async (blob: File, headerInfo: HeaderInfo) => {
  const { header, data } = await readExcel(blob, true);
  console.log({ header, data });

  const fieldMap = new Map(headerInfo.map((col) => [col.label, col.name]));
  const fields = header
    .map((label) => fieldMap.get(String(label)))
    .filter((name): name is string => typeof name == 'string');

  const string_as_numbers = new Map(
    headerInfo.map((col) => [col.name, col.string_as_number])
  );

  return data.map((row) => {
    const item: { [key: string]: string | Date | number } = {};
    fields.forEach((name, i) => {
      item[name] =
        typeof row[i] == 'string' && string_as_numbers.get(name)
          ? +row[i]
          : row[i];
    });
    return item;
  });
};

export default readExcel;
