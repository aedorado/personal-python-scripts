// ---------------------
// Time Conversion Utils
// ---------------------


const convertToMinutes = (timeStr, isSleep = false) => {
    timeStr = timeStr.replace('.', ':').trim();
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
 
 
    let [_, hours, minutes, period] = match;
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    period = period.toUpperCase();
 
 
    if (isSleep && period === 'AM' && hours >= 6 && hours != 12) return null;
 
 
    if (period === 'AM' && hours === 12) hours = 0;
    if (period === 'PM' && hours !== 12) hours += 12;
 
 
    let total = hours * 60 + minutes;
    if (isSleep && period === 'AM' && total < 720) total += 1440;
    return total;
 };
 
 
 const minutesToTimeString = (totalMinutes) => {
    if (isNaN(totalMinutes)) return 'N/A';
    totalMinutes %= 1440;
 
 
    let hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
 
 
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
 
 
    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
 };
 
 
 const formatMinutesToHoursAndMinutes = (totalMinutes) => {
    if (isNaN(totalMinutes)) return 'N/A';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
 };
 
 
 
 
 
 
 // ---------------------
 // Data Extraction
 // ---------------------
 
 
 const extractData = (allFiltersGroups = [], anyFiltersGroups = []) => {
    const result = [];
 
 
    document.querySelectorAll('div.copyable-text').forEach(div => {
        const text = div.innerText.trim().toLowerCase();
 
 
        // Matches at least one of the allFiltersGroups (every filter in that group must be present)
        const matchesAll = allFiltersGroups.length === 0 || allFiltersGroups.some(group =>
            group.every(f => text.includes(f.toLowerCase()))
        );
 
 
        // Matches any of the anyFiltersGroups (at least one filter in any group)
        const matchesAny = anyFiltersGroups.length === 0 || anyFiltersGroups.some(group =>
            group.some(f => text.includes(f.toLowerCase()))
        );
 
 
        if (matchesAll && matchesAny) {
            result.push(div);
        }
    });
 
 
    return result;
 };
 
 
 ignoreList = [];
 
 
 // previous version of the function
 // const extractData = () => {
   
 //     // var filterTexts1 = ['7', '13'].map(t => t.toLowerCase());
 //     // var filterTexts2 = ['march', 'mar'].map(t => t.toLowerCase());
 //     // var filterTexts3 = ['apr', 'april'].map(t => t.toLowerCase());
 
 
 //     const result = [];
 //     document.querySelectorAll('div.copyable-text').forEach(div => {
 //         const text = div.innerText.trim().toLowerCase();
 //         if (
 //             filterTexts1.every(f => text.includes(f)) &&
 //             // filterTexts2.some(f => text.includes(f)) &&
 //             filterTexts3.some(f => text.includes(f))
 //         ) {
 //             result.push(div);
 //         }
 //     });
 //     return result;
 // };
 
 
 // ---------------------
 // Data Processing
 // ---------------------
 const processData = (divs) => {
    const data = [];
    ignoreList = [];
 
 
    divs.forEach(div => {
        const text = div.innerText.trim();
        const nameMatch = text.match(/[*]?\bName[*]?\s*[-:–]?\s*(.+?)\s*\n/i);
        const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
        // ignoring nameless
        if (name === 'Unknown') return;
 
 
        const getNumbers = (regex) => {
            const match = text.match(regex);
            return match
                ? match[1].split('•').map(s => parseInt(s.replace('+', '').trim())).filter(n => !isNaN(n))
                : [];
        };
 
 
        const getTime = (regex) => {
            const match = text.match(regex);
            return match
                ? match[1]
                    .split('•')
                    .map(s => s.trim().replace(/\s*\d+$/, ''))
                    .filter(t => /^\d{1,2}([.:]\d{2})? ?[APM]{2}$/.test(t))
                : [];
        };
 
 
        const roundsArr = getNumbers(/Total Rounds:\s*([\d\s•]+)/i);
        const readingArr = getNumbers(/Reading\s*\(minutes\):\s*([\d+•\s]+)/i);
        const hearingArr = getNumbers(/Hearing\s*\(minutes\):?\s*([\d+•\s]+)/i);
        const dayRestArr = getNumbers(/Day\s*(?:rest\s*(?:\(minutes\))?|rest):\s*([\d+•\s]+)/i);
 
 
        const wakeupArr = getTime(/(?:Today's\s*Wake up time|Wake up time):\s*([\d\s•:APM]+)/i);
        const sleepArr = getTime(/Last\s*Night(?:'s)?\s*Sleep\s*time:?\s*([\d\s•:APM]+)/i);
 
 
        const missingFields = [];
        if (!roundsArr.length) missingFields.push('rounds');
        if (!readingArr.length) missingFields.push('reading');
        if (!hearingArr.length) missingFields.push('hearing');
        if (!wakeupArr.length) missingFields.push('wakeup time');
        if (!sleepArr.length) missingFields.push('sleep time');
        if (!dayRestArr.length) missingFields.push('day rest');
 
 
        if (missingFields.length) {
            console.warn(`⚠️ Missing data for ${name}: ${missingFields.join(', ')}`);
            ignoreList.push(`${name}-${missingFields.join(',')} `);
            console.error(text);
        }
        if (missingFields.length === 6) {
            return;
        }
 
 
        const wakeupTimes = wakeupArr.map(t => convertToMinutes(t, false)).filter(n => n !== null);
        const sleepTimes = sleepArr.map(t => convertToMinutes(t, true)).filter(n => n !== null);
 
 
        const avg = arr => arr.length ? Math.floor(arr.reduce((a, b) => a + b, 0) / arr.length) : NaN;
        const avgWakeMinutes = avg(wakeupTimes);
        const avgSleepMinutes = avg(sleepTimes);
        const avgDayRest = avg(dayRestArr);
 
 
        const sleepDurations = [];
        const totalRestDurations = [];
 
 
        for (let i = 0; i < wakeupTimes.length && i < sleepTimes.length; i++) {
            const wake = wakeupTimes[i];
            const sleep = sleepTimes[i];
            const duration = (1440 - sleep) + wake;
            const adjDuration = duration > 1440 ? duration - 1440 : duration;
            if (!isNaN(adjDuration)) {
                sleepDurations.push(adjDuration);
                if (i < dayRestArr.length) {
                    totalRestDurations.push(adjDuration + dayRestArr[i]);
                }
            }
        }
 
 
        const avgSleepDuration = avg(sleepDurations);
        const avgTotalRestDuration = avg(totalRestDurations);
 
 
        data.push({
            name,
            totalRounds: roundsArr.reduce((a, b) => a + b, 0),
            totalReading: readingArr.reduce((a, b) => a + b, 0),
            totalHearing: hearingArr.reduce((a, b) => a + b, 0),
            roundsArr,
            readingArr,
            hearingArr,
            wakeupArr,
            sleepArr,
            dayRestArr,
            avgWakeMinutes,
            avgSleepMinutes,
            avgDayRest,
            sleepDurations,
            avgSleepDuration,
            avgTotalRestDuration,
            wakeupTimes,
            sleepTimes,
        });
    });
 
 
    return data;
 };
 
 
 // ---------------------
 // Printing Functions
 // ---------------------
 function printTotalMetrics(data) {
    const count = data.length;
    const totalRounds = data.reduce((acc, d) => acc + d.totalRounds, 0);
    const totalReading = data.reduce((acc, d) => acc + d.totalReading, 0);
    const totalHearing = data.reduce((acc, d) => acc + d.totalHearing, 0);
    const avgRounds = Math.floor(totalRounds / (7 * count));
    const avgReading = Math.floor(totalReading / (7 * count));
    const avgHearing = Math.floor(totalHearing / (7 * count));
 
 
    const totalWakeTimeMinutes = data.reduce((acc, d) => acc + (d.avgWakeMinutes || 0), 0);
    const totalSleepTimeMinutes = data.reduce((acc, d) => acc + (d.avgSleepMinutes || 0), 0);
    const totalDayRest = data.reduce((acc, d) => acc + (d.avgDayRest || 0), 0);
    const totalSleepDuration = data.reduce((acc, d) => acc + (d.avgSleepDuration || 0), 0);
    const totalRest = data.reduce((acc, d) => acc + (d.avgTotalRestDuration || 0), 0);
 
 
    const avgWakeMinutes = totalWakeTimeMinutes ? Math.floor(totalWakeTimeMinutes / count) : NaN;
    const avgSleepMinutes = totalSleepTimeMinutes ? Math.floor(totalSleepTimeMinutes / count) : NaN;
    const avgDayRest = totalDayRest ? Math.floor(totalDayRest / count) : NaN;
    const avgSleepDuration = totalSleepDuration ? Math.floor(totalSleepDuration / count) : NaN;
    const avgTotalRest = totalRest ? Math.floor(totalRest / count) : NaN;
 
 
    let result = '';
    result += `📋 Total Devotees Reported: ${count}\n\n`;
    result += `⚠️❌⚠️ Incorrect Formatting: ${ignoreList}\n\n`;
 
 
    result += `🧘‍♂️ Total Rounds Chanted: ${totalRounds}\n`;
    result += `🔁 Avg Rounds/Day: ${avgRounds}\n\n`;
    result += `📖 Total Reading: ${totalReading} min\n`;
    result += `📚 Avg Reading/Day: ${avgReading} min\n\n`;
    result += `🎧 Total Hearing: ${totalHearing} min\n`;
    result += `🕉️ Avg Hearing/Day: ${avgHearing} min\n`;
 
 
    result += `\n⏰ Avg Wake-up Time: ${isNaN(avgWakeMinutes) ? 'N/A' : minutesToTimeString(avgWakeMinutes)}\n`;
    result += `😴 Avg Sleep Time: ${isNaN(avgSleepMinutes) ? 'N/A' : minutesToTimeString(avgSleepMinutes)}\n`;
 
 
    result += `\n🛌 Avg Night Sleep Duration: ${isNaN(avgSleepDuration) ? 'N/A' : formatMinutesToHoursAndMinutes(avgSleepDuration)}\n`;
    result += `🛋️ Avg Day Rest: ${isNaN(avgDayRest) ? 'N/A' : avgDayRest + ' mins'}\n`;
    result += `💤 Avg Total Sleep Duration: ${isNaN(avgTotalRest) ? 'N/A' : formatMinutesToHoursAndMinutes(avgTotalRest)}\n`;
 
 
    result += '\n' + '🟰'.repeat(25) + '\n';
    return result;
 }
 
 
 function printLeaderboard(data, category, topN, previousData = []) {
    let sorted = [];
    let title = '';
    let unit = '';
    let emoji = '';
 
 
    switch (category) {
        case 'chanting':
            sorted = [...data].sort((a, b) => b.totalRounds - a.totalRounds);
            title = 'Namacharyas (Chanting)'; unit = 'rounds'; emoji = '🧘‍♂️'; break;
        case 'reading':
            sorted = [...data].sort((a, b) => b.totalReading - a.totalReading);
            title = 'Bhagavata-Parayanis (Reading)'; unit = 'mins'; emoji = '📖'; break;
        case 'hearing':
            sorted = [...data].sort((a, b) => b.totalHearing - a.totalHearing);
            title = 'Chakors (Hearing)'; unit = 'mins'; emoji = '🎧'; break;
        case 'wakeup':
            sorted = [...data].filter(d => !isNaN(d.avgWakeMinutes)).sort((a, b) => a.avgWakeMinutes - b.avgWakeMinutes);
            title = 'Brahma-Muhurta-Dhiras (Early Risers)'; emoji = '🌅'; break;
        case 'sleep':
            sorted = [...data].filter(d => !isNaN(d.avgSleepMinutes)).sort((a, b) => a.avgSleepMinutes - b.avgSleepMinutes);
            title = 'Shayana-Shuddhas (Early Sleepers)'; emoji = '🌙'; break;
        case 'dayrest':
            sorted = [...data].filter(d => !isNaN(d.avgDayRest)).sort((a, b) => a.avgDayRest - b.avgDayRest);
            title = 'Nidra-Vinirmuktas (Least Day Rest)'; emoji = '💤'; break;
        case 'sleepduration':
            sorted = [...data].filter(d => !isNaN(d.avgSleepDuration)).sort((a, b) => a.avgSleepDuration - b.avgSleepDuration);
            title = 'Shayana-Shuddhas (Least Night Sleep)'; unit = 'hrs'; emoji = '🛌'; break;
        case 'avgTotalRestDuration':
            sorted = [...data].filter(d => !isNaN(d.avgTotalRestDuration)).sort((a, b) => a.avgTotalRestDuration - b.avgTotalRestDuration);
            title = 'Gudakeshas (Least Total Sleep)'; unit = 'hrs'; emoji = '😇'; break;
        default:
            return `❗ Invalid category: ${category}\n`;
    }
 
 
    // Create a map of previous positions
    const previousSorted = [...previousData];
    switch (category) {
        case 'chanting': previousSorted.sort((a, b) => b.totalRounds - a.totalRounds); break;
        case 'reading': previousSorted.sort((a, b) => b.totalReading - a.totalReading); break;
        case 'hearing': previousSorted.sort((a, b) => b.totalHearing - a.totalHearing); break;
        case 'wakeup': previousSorted.sort((a, b) => a.avgWakeMinutes - b.avgWakeMinutes); break;
        case 'sleep': previousSorted.sort((a, b) => a.avgSleepMinutes - b.avgSleepMinutes); break;
        case 'dayrest': previousSorted.sort((a, b) => a.avgDayRest - b.avgDayRest); break;
        case 'sleepduration': previousSorted.sort((a, b) => a.avgSleepDuration - b.avgSleepDuration); break;
        case 'avgTotalRestDuration': previousSorted.sort((a, b) => a.avgTotalRestDuration - b.avgTotalRestDuration); break;
    }
 
 
    const previousRanks = {};
    previousSorted.forEach((d, i) => previousRanks[d.name] = i + 1);
 
 
    let result = `🏅 Top ${topN} ${emoji} ${title}:\n`;
 
 
    sorted.slice(0, topN).forEach((d, i) => {
        let value = '';
        if (category === 'chanting') {
            const avg = Math.floor(d.totalRounds / 7);
            value = `${d.totalRounds} (${avg} ${unit}/day)`;
        } else if (category === 'reading') {
            const avg = Math.floor(d.totalReading / 7);
            value = `${d.totalReading} (${avg} ${unit}/day)`;
        } else if (category === 'hearing') {
            const avg = Math.floor(d.totalHearing / 7);
            value = `${d.totalHearing} (${avg} ${unit}/day)`;
        } else if (category === 'wakeup') {
            value = minutesToTimeString(d.avgWakeMinutes);
        } else if (category === 'sleep') {
            value = minutesToTimeString(d.avgSleepMinutes);
        } else if (category === 'dayrest') {
            value = `${d.avgDayRest} mins`;
        } else if (category === 'sleepduration') {
            value = formatMinutesToHoursAndMinutes(d.avgSleepDuration);
        } else if (category === 'avgTotalRestDuration') {
            value = formatMinutesToHoursAndMinutes(d.avgTotalRestDuration);
        }
 
 
        const prevRank = previousRanks[d.name];
        let movement = '';
        if (prevRank) {
            const change = prevRank - (i + 1);
            if (change > 0) movement = ` (🟢 ${change} spots gained)`;
            else if (change < 0) movement = ` (🔴 ${Math.abs(change)} spots lost)`;
            else movement = ' 🟡 spot retained';
        }
 
 
        result += `${i + 1}. ${(i == 0) ? '👑' : ''} ${d.name} - ${value}${movement}\n`;
    });
 
 
    result += '\n' + '🏁'.repeat(25) + '\n';
    return result;
 }
 
 
 
 
 // ---------------------
 // Main Execution
 // ---------------------
 function runReport() {
 
 
    var allFilters1 = ['7', '13'].map(t => t.toLowerCase());
    var allFilters2 = ['31', '6'].map(t => t.toLowerCase());
    var someFilters1 = ['march', 'mar'].map(t => t.toLowerCase());
    var someFilters2 = ['apr', 'april'].map(t => t.toLowerCase());
 
 
    const  previousWeekDivs = extractData([allFilters2], [someFilters1, someFilters2]);
    const previousWeekData = processData(previousWeekDivs);
    // const previousWeekData = [];
    const  currentWeekDivs = extractData([allFilters1, ['7', '14']], [someFilters2]);
    const currentWeekData = processData(currentWeekDivs);
 
 
    console.log(currentWeekData, previousWeekData, ignoreList);
 
 
    let finalOutput = '';
    finalOutput += printTotalMetrics(currentWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'chanting', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'reading', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'hearing', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'wakeup', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'sleep', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'dayrest', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'sleepduration', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'avgTotalRestDuration', 10, previousWeekData);
 
 
   
 
 
    console.log(finalOutput);
 
 
    // finalOutput = '';
    // finalOutput += printTotalMetrics(previousWeekData);
    // finalOutput += printLeaderboard(previousWeekData, 'chanting', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'reading', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'hearing', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'wakeup', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'sleep', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'dayrest', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'sleepduration', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'avgTotalRestDuration', 3);
    // console.log(finalOutput);
 }
 
 
 runReport();
 
 
 // ---------------------
 // Time Conversion Utils
 // ---------------------
 
 
 const convertToMinutes = (timeStr, isSleep = false) => {
    timeStr = timeStr.replace('.', ':').trim();
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
 
 
    let [_, hours, minutes, period] = match;
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    period = period.toUpperCase();
 
 
    if (isSleep && period === 'AM' && hours >= 6 && hours != 12) return null;
 
 
    if (period === 'AM' && hours === 12) hours = 0;
    if (period === 'PM' && hours !== 12) hours += 12;
 
 
    let total = hours * 60 + minutes;
    if (isSleep && period === 'AM' && total < 720) total += 1440;
    return total;
 };
 
 
 const minutesToTimeString = (totalMinutes) => {
    if (isNaN(totalMinutes)) return 'N/A';
    totalMinutes %= 1440;
 
 
    let hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
 
 
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
 
 
    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
 };
 
 
 const formatMinutesToHoursAndMinutes = (totalMinutes) => {
    if (isNaN(totalMinutes)) return 'N/A';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
 };
 
 
 
 
 
 
 // ---------------------
 // Data Extraction
 // ---------------------
 
 
 const extractData = (allFiltersGroups = [], anyFiltersGroups = []) => {
    const result = [];
 
 
    document.querySelectorAll('div.copyable-text').forEach(div => {
        const text = div.innerText.trim().toLowerCase();
 
 
        // Matches at least one of the allFiltersGroups (every filter in that group must be present)
        const matchesAll = allFiltersGroups.length === 0 || allFiltersGroups.some(group =>
            group.every(f => text.includes(f.toLowerCase()))
        );
 
 
        // Matches any of the anyFiltersGroups (at least one filter in any group)
        const matchesAny = anyFiltersGroups.length === 0 || anyFiltersGroups.some(group =>
            group.some(f => text.includes(f.toLowerCase()))
        );
 
 
        if (matchesAll && matchesAny) {
            result.push(div);
        }
    });
 
 
    return result;
 };
 
 
 ignoreList = [];
 
 
 // previous version of the function
 // const extractData = () => {
   
 //     // var filterTexts1 = ['7', '13'].map(t => t.toLowerCase());
 //     // var filterTexts2 = ['march', 'mar'].map(t => t.toLowerCase());
 //     // var filterTexts3 = ['apr', 'april'].map(t => t.toLowerCase());
 
 
 //     const result = [];
 //     document.querySelectorAll('div.copyable-text').forEach(div => {
 //         const text = div.innerText.trim().toLowerCase();
 //         if (
 //             filterTexts1.every(f => text.includes(f)) &&
 //             // filterTexts2.some(f => text.includes(f)) &&
 //             filterTexts3.some(f => text.includes(f))
 //         ) {
 //             result.push(div);
 //         }
 //     });
 //     return result;
 // };
 
 
 // ---------------------
 // Data Processing
 // ---------------------
 const processData = (divs) => {
    const data = [];
    ignoreList = [];
 
 
    divs.forEach(div => {
        const text = div.innerText.trim();
        const nameMatch = text.match(/[*]?\bName[*]?\s*[-:–]?\s*(.+?)\s*\n/i);
        const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
        // ignoring nameless
        if (name === 'Unknown') return;
 
 
        const getNumbers = (regex) => {
            const match = text.match(regex);
            return match
                ? match[1].split('•').map(s => parseInt(s.replace('+', '').trim())).filter(n => !isNaN(n))
                : [];
        };
 
 
        const getTime = (regex) => {
            const match = text.match(regex);
            return match
                ? match[1]
                    .split('•')
                    .map(s => s.trim().replace(/\s*\d+$/, ''))
                    .filter(t => /^\d{1,2}([.:]\d{2})? ?[APM]{2}$/.test(t))
                : [];
        };
 
 
        const roundsArr = getNumbers(/Total Rounds:\s*([\d\s•]+)/i);
        const readingArr = getNumbers(/Reading\s*\(minutes\):\s*([\d+•\s]+)/i);
        const hearingArr = getNumbers(/Hearing\s*\(minutes\):?\s*([\d+•\s]+)/i);
        const dayRestArr = getNumbers(/Day\s*(?:rest\s*(?:\(minutes\))?|rest):\s*([\d+•\s]+)/i);
 
 
        const wakeupArr = getTime(/(?:Today's\s*Wake up time|Wake up time):\s*([\d\s•:APM]+)/i);
        const sleepArr = getTime(/Last\s*Night(?:'s)?\s*Sleep\s*time:?\s*([\d\s•:APM]+)/i);
 
 
        const missingFields = [];
        if (!roundsArr.length) missingFields.push('rounds');
        if (!readingArr.length) missingFields.push('reading');
        if (!hearingArr.length) missingFields.push('hearing');
        if (!wakeupArr.length) missingFields.push('wakeup time');
        if (!sleepArr.length) missingFields.push('sleep time');
        if (!dayRestArr.length) missingFields.push('day rest');
 
 
        if (missingFields.length) {
            console.warn(`⚠️ Missing data for ${name}: ${missingFields.join(', ')}`);
            ignoreList.push(`${name}-${missingFields.join(',')} `);
            console.error(text);
        }
        if (missingFields.length === 6) {
            return;
        }
 
 
        const wakeupTimes = wakeupArr.map(t => convertToMinutes(t, false)).filter(n => n !== null);
        const sleepTimes = sleepArr.map(t => convertToMinutes(t, true)).filter(n => n !== null);
 
 
        const avg = arr => arr.length ? Math.floor(arr.reduce((a, b) => a + b, 0) / arr.length) : NaN;
        const avgWakeMinutes = avg(wakeupTimes);
        const avgSleepMinutes = avg(sleepTimes);
        const avgDayRest = avg(dayRestArr);
 
 
        const sleepDurations = [];
        const totalRestDurations = [];
 
 
        for (let i = 0; i < wakeupTimes.length && i < sleepTimes.length; i++) {
            const wake = wakeupTimes[i];
            const sleep = sleepTimes[i];
            const duration = (1440 - sleep) + wake;
            const adjDuration = duration > 1440 ? duration - 1440 : duration;
            if (!isNaN(adjDuration)) {
                sleepDurations.push(adjDuration);
                if (i < dayRestArr.length) {
                    totalRestDurations.push(adjDuration + dayRestArr[i]);
                }
            }
        }
 
 
        const avgSleepDuration = avg(sleepDurations);
        const avgTotalRestDuration = avg(totalRestDurations);
 
 
        data.push({
            name,
            totalRounds: roundsArr.reduce((a, b) => a + b, 0),
            totalReading: readingArr.reduce((a, b) => a + b, 0),
            totalHearing: hearingArr.reduce((a, b) => a + b, 0),
            roundsArr,
            readingArr,
            hearingArr,
            wakeupArr,
            sleepArr,
            dayRestArr,
            avgWakeMinutes,
            avgSleepMinutes,
            avgDayRest,
            sleepDurations,
            avgSleepDuration,
            avgTotalRestDuration,
            wakeupTimes,
            sleepTimes,
        });
    });
 
 
    return data;
 };
 
 
 // ---------------------
 // Printing Functions
 // ---------------------
 function printTotalMetrics(data) {
    const count = data.length;
    const totalRounds = data.reduce((acc, d) => acc + d.totalRounds, 0);
    const totalReading = data.reduce((acc, d) => acc + d.totalReading, 0);
    const totalHearing = data.reduce((acc, d) => acc + d.totalHearing, 0);
    const avgRounds = Math.floor(totalRounds / (7 * count));
    const avgReading = Math.floor(totalReading / (7 * count));
    const avgHearing = Math.floor(totalHearing / (7 * count));
 
 
    const totalWakeTimeMinutes = data.reduce((acc, d) => acc + (d.avgWakeMinutes || 0), 0);
    const totalSleepTimeMinutes = data.reduce((acc, d) => acc + (d.avgSleepMinutes || 0), 0);
    const totalDayRest = data.reduce((acc, d) => acc + (d.avgDayRest || 0), 0);
    const totalSleepDuration = data.reduce((acc, d) => acc + (d.avgSleepDuration || 0), 0);
    const totalRest = data.reduce((acc, d) => acc + (d.avgTotalRestDuration || 0), 0);
 
 
    const avgWakeMinutes = totalWakeTimeMinutes ? Math.floor(totalWakeTimeMinutes / count) : NaN;
    const avgSleepMinutes = totalSleepTimeMinutes ? Math.floor(totalSleepTimeMinutes / count) : NaN;
    const avgDayRest = totalDayRest ? Math.floor(totalDayRest / count) : NaN;
    const avgSleepDuration = totalSleepDuration ? Math.floor(totalSleepDuration / count) : NaN;
    const avgTotalRest = totalRest ? Math.floor(totalRest / count) : NaN;
 
 
    let result = '';
    result += `📋 Total Devotees Reported: ${count}\n\n`;
    result += `⚠️❌⚠️ Incorrect Formatting: ${ignoreList}\n\n`;
 
 
    result += `🧘‍♂️ Total Rounds Chanted: ${totalRounds}\n`;
    result += `🔁 Avg Rounds/Day: ${avgRounds}\n\n`;
    result += `📖 Total Reading: ${totalReading} min\n`;
    result += `📚 Avg Reading/Day: ${avgReading} min\n\n`;
    result += `🎧 Total Hearing: ${totalHearing} min\n`;
    result += `🕉️ Avg Hearing/Day: ${avgHearing} min\n`;
 
 
    result += `\n⏰ Avg Wake-up Time: ${isNaN(avgWakeMinutes) ? 'N/A' : minutesToTimeString(avgWakeMinutes)}\n`;
    result += `😴 Avg Sleep Time: ${isNaN(avgSleepMinutes) ? 'N/A' : minutesToTimeString(avgSleepMinutes)}\n`;
 
 
    result += `\n🛌 Avg Night Sleep Duration: ${isNaN(avgSleepDuration) ? 'N/A' : formatMinutesToHoursAndMinutes(avgSleepDuration)}\n`;
    result += `🛋️ Avg Day Rest: ${isNaN(avgDayRest) ? 'N/A' : avgDayRest + ' mins'}\n`;
    result += `💤 Avg Total Sleep Duration: ${isNaN(avgTotalRest) ? 'N/A' : formatMinutesToHoursAndMinutes(avgTotalRest)}\n`;
 
 
    result += '\n' + '🟰'.repeat(25) + '\n';
    return result;
 }
 
 
 function printLeaderboard(data, category, topN, previousData = []) {
    let sorted = [];
    let title = '';
    let unit = '';
    let emoji = '';
 
 
    switch (category) {
        case 'chanting':
            sorted = [...data].sort((a, b) => b.totalRounds - a.totalRounds);
            title = 'Namacharyas (Chanting)'; unit = 'rounds'; emoji = '🧘‍♂️'; break;
        case 'reading':
            sorted = [...data].sort((a, b) => b.totalReading - a.totalReading);
            title = 'Bhagavata-Parayanis (Reading)'; unit = 'mins'; emoji = '📖'; break;
        case 'hearing':
            sorted = [...data].sort((a, b) => b.totalHearing - a.totalHearing);
            title = 'Chakors (Hearing)'; unit = 'mins'; emoji = '🎧'; break;
        case 'wakeup':
            sorted = [...data].filter(d => !isNaN(d.avgWakeMinutes)).sort((a, b) => a.avgWakeMinutes - b.avgWakeMinutes);
            title = 'Brahma-Muhurta-Dhiras (Early Risers)'; emoji = '🌅'; break;
        case 'sleep':
            sorted = [...data].filter(d => !isNaN(d.avgSleepMinutes)).sort((a, b) => a.avgSleepMinutes - b.avgSleepMinutes);
            title = 'Shayana-Shuddhas (Early Sleepers)'; emoji = '🌙'; break;
        case 'dayrest':
            sorted = [...data].filter(d => !isNaN(d.avgDayRest)).sort((a, b) => a.avgDayRest - b.avgDayRest);
            title = 'Nidra-Vinirmuktas (Least Day Rest)'; emoji = '💤'; break;
        case 'sleepduration':
            sorted = [...data].filter(d => !isNaN(d.avgSleepDuration)).sort((a, b) => a.avgSleepDuration - b.avgSleepDuration);
            title = 'Shayana-Shuddhas (Least Night Sleep)'; unit = 'hrs'; emoji = '🛌'; break;
        case 'avgTotalRestDuration':
            sorted = [...data].filter(d => !isNaN(d.avgTotalRestDuration)).sort((a, b) => a.avgTotalRestDuration - b.avgTotalRestDuration);
            title = 'Gudakeshas (Least Total Sleep)'; unit = 'hrs'; emoji = '😇'; break;
        default:
            return `❗ Invalid category: ${category}\n`;
    }
 
 
    // Create a map of previous positions
    const previousSorted = [...previousData];
    switch (category) {
        case 'chanting': previousSorted.sort((a, b) => b.totalRounds - a.totalRounds); break;
        case 'reading': previousSorted.sort((a, b) => b.totalReading - a.totalReading); break;
        case 'hearing': previousSorted.sort((a, b) => b.totalHearing - a.totalHearing); break;
        case 'wakeup': previousSorted.sort((a, b) => a.avgWakeMinutes - b.avgWakeMinutes); break;
        case 'sleep': previousSorted.sort((a, b) => a.avgSleepMinutes - b.avgSleepMinutes); break;
        case 'dayrest': previousSorted.sort((a, b) => a.avgDayRest - b.avgDayRest); break;
        case 'sleepduration': previousSorted.sort((a, b) => a.avgSleepDuration - b.avgSleepDuration); break;
        case 'avgTotalRestDuration': previousSorted.sort((a, b) => a.avgTotalRestDuration - b.avgTotalRestDuration); break;
    }
 
 
    const previousRanks = {};
    previousSorted.forEach((d, i) => previousRanks[d.name] = i + 1);
 
 
    let result = `🏅 Top ${topN} ${emoji} ${title}:\n`;
 
 
    sorted.slice(0, topN).forEach((d, i) => {
        let value = '';
        if (category === 'chanting') {
            const avg = Math.floor(d.totalRounds / 7);
            value = `${d.totalRounds} (${avg} ${unit}/day)`;
        } else if (category === 'reading') {
            const avg = Math.floor(d.totalReading / 7);
            value = `${d.totalReading} (${avg} ${unit}/day)`;
        } else if (category === 'hearing') {
            const avg = Math.floor(d.totalHearing / 7);
            value = `${d.totalHearing} (${avg} ${unit}/day)`;
        } else if (category === 'wakeup') {
            value = minutesToTimeString(d.avgWakeMinutes);
        } else if (category === 'sleep') {
            value = minutesToTimeString(d.avgSleepMinutes);
        } else if (category === 'dayrest') {
            value = `${d.avgDayRest} mins`;
        } else if (category === 'sleepduration') {
            value = formatMinutesToHoursAndMinutes(d.avgSleepDuration);
        } else if (category === 'avgTotalRestDuration') {
            value = formatMinutesToHoursAndMinutes(d.avgTotalRestDuration);
        }
 
 
        const prevRank = previousRanks[d.name];
        let movement = '';
        if (prevRank) {
            const change = prevRank - (i + 1);
            if (change > 0) movement = ` (🟢 ${change} spots gained)`;
            else if (change < 0) movement = ` (🔴 ${Math.abs(change)} spots lost)`;
            else movement = ' 🟡 spot retained';
        }
 
 
        result += `${i + 1}. ${(i == 0) ? '👑' : ''} ${d.name} - ${value}${movement}\n`;
    });
 
 
    result += '\n' + '🏁'.repeat(25) + '\n';
    return result;
 }
 
 
 
 
 // ---------------------
 // Main Execution
 // ---------------------
 function runReport() {
 
 
    var allFilters1 = ['7', '13'].map(t => t.toLowerCase());
    var allFilters2 = ['31', '6'].map(t => t.toLowerCase());
    var someFilters1 = ['march', 'mar'].map(t => t.toLowerCase());
    var someFilters2 = ['apr', 'april'].map(t => t.toLowerCase());
 
 
    const  previousWeekDivs = extractData([allFilters2], [someFilters1, someFilters2]);
    const previousWeekData = processData(previousWeekDivs);
    // const previousWeekData = [];
    const  currentWeekDivs = extractData([allFilters1, ['7', '14']], [someFilters2]);
    const currentWeekData = processData(currentWeekDivs);
 
 
    console.log(currentWeekData, previousWeekData, ignoreList);
 
 
    let finalOutput = '';
    finalOutput += printTotalMetrics(currentWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'chanting', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'reading', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'hearing', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'wakeup', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'sleep', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'dayrest', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'sleepduration', 10, previousWeekData);
    finalOutput += printLeaderboard(currentWeekData, 'avgTotalRestDuration', 10, previousWeekData);
 
 
   
 
 
    console.log(finalOutput);
 
 
    // finalOutput = '';
    // finalOutput += printTotalMetrics(previousWeekData);
    // finalOutput += printLeaderboard(previousWeekData, 'chanting', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'reading', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'hearing', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'wakeup', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'sleep', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'dayrest', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'sleepduration', 3);
    // finalOutput += printLeaderboard(previousWeekData, 'avgTotalRestDuration', 3);
    // console.log(finalOutput);
 }
 
 
 runReport();
 
 
 
 
 
 