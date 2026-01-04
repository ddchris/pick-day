import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const excelPath = path.resolve('115年辦公日曆表.xlsx');
const publicDir = path.resolve('public');
const outputPath = path.resolve(publicDir, 'holidays.json');

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

if (!fs.existsSync(excelPath)) {
    console.error('Excel file not found:', excelPath);
    process.exit(1);
}

try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0]; // Assume first sheet
    const sheet = workbook.Sheets[sheetName];
    
    // Parse
    const rawData = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`Read ${rawData.length} rows from Excel.`);
    if (rawData.length > 0) {
        console.log('Sample Headers:', Object.keys(rawData[0]));
    }

    // Filter and Map
    // Gov format usually: "西元日期" (e.g. 20260101), "是否放假" (2=holiday), "放假之紀念日及節日名稱"
    const holidays = rawData.filter(row => {
        // "是否放假": 2 means holiday/weekend off? 
        // Actually usually "是否放假" column indicates strict holiday status.
        // Let's assume if it has a holiday name OR is marked as holiday.
        return row['是否放假'] === 2 || (row['放假之紀念日及節日名稱'] && row['放假之紀念日及節日名稱'].trim() !== '');
    }).map(row => {
        const rawDate = String(row['西元日期']); // 20260101
        const dateStr = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
        
        return {
            date: dateStr,
            name: row['放假之紀念日及節日名稱'] || '放假',
            isHoliday: true
        };
    });

    fs.writeFileSync(outputPath, JSON.stringify(holidays, null, 2));
    console.log(`Success! Wrote ${holidays.length} holidays to ${outputPath}`);
    
} catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
        console.error('Error: xlsx package not found. Please run "npm install xlsx".');
    } else {
        console.error('Conversion failed:', e);
    }
}
