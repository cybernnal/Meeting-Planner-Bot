function parseAndValidateDateTime(dateString, time) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
        return { error: '❌ Please enter the time in HH:MM format (e.g., 09:00 or 18:30).' };
    }

    let day, month, year;
    const dateParts = dateString.split('/');

    if (dateParts.length === 2) {
        day = dateParts[0];
        month = dateParts[1];
        year = new Date().getFullYear().toString();
    } else if (dateParts.length === 3) {
        day = dateParts[0];
        month = dateParts[1];
        year = dateParts[2];
        if (year.length === 2) {
            year = `20${year}`;
        }
    } else {
        return { error: '❌ Please enter the date in DD/MM or DD/MM/YY format.' };
    }

    const [hours, minutes] = time.split(':').map(part => parseInt(part, 10));

    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hours, minutes, 0);
    const timestamp = Math.floor(date.getTime() / 1000);

    return { date, timestamp, day, month, year, time };
}

module.exports = {
    parseAndValidateDateTime
};