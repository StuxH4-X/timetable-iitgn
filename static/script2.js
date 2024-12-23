function filterCoursesByHalf(selectedData, halfType) {
    return selectedData.filter(course => {
        const courseName = course["Course Name"];
        if (courseName.includes("First Half") && halfType === "First Half") {
            return true;
        }
        if (courseName.includes("Second Half") && halfType === "Second Half") {
            return true;
        }
        return !courseName.includes("First Half") && !courseName.includes("Second Half");
    });
}

function mapCoursesToSlots(selectedData) {
    const slotMapping = {};

    selectedData.forEach(course => {
        ["Lecture", "Tutorial", "Lab"].forEach(type => {
            const slotsWithVenue = course[type]?.split("\n") || [];

            for (let i = 0; i < slotsWithVenue.length; i++) {
                const slotLine = slotsWithVenue[i].trim();
                const venueLine = slotsWithVenue[i + 1]?.trim();
                
                const venueMatch = venueLine?.match(/^\((.*?)\)$/);
                const venue = venueMatch ? venueMatch[1].trim() : "No Venue";
                
                const slotMatch = slotLine.match(/[A-Z]\d+(?:,[A-Z]\d+)*/g);
                const slots = slotMatch
                    ? slotMatch[0].split(",").map(slot => slot.trim())
                    : [];

                if (slots.length > 0) {
                    
                    if (venueMatch) i++;
                    
                    slots.forEach(slot => {
                        if (!slotMapping[slot]) {
                            slotMapping[slot] = [];
                        }
                        const courseName = course["Course Name"].replace(/\s*\(.*?\)\s*/g, "").trim();
                        slotMapping[slot].push(`${courseName} (${venue})`);
                    });
                }
            }
        });
    });

    return slotMapping;
}

const colors = ["#FDFCEC","#FEF4EB","#FFEBEC","#F8DEF3","#E8DEF8","#C9DCF8","#C7EDF9","#B4F3F8","#C7F9EF","#D8FDDD","#FBF8CC","#FDE4CF","#FFCFD2","#F1C0E8","#CFBAF0","#A3C4F3","#90DBF4","#8EECF5","#98F5E1","#B9FBC0"]

const uniqueCourses = [...new Set(selectedData.map(course => course["Course Name"].replace(/\s*\(.*?\)\s*/g, "").trim()))];
const courseColors = {};
uniqueCourses.forEach((course, index) => {
    courseColors[course] = colors[index % colors.length];
});

function renderTableWithConflicts(data, slotMapping, table = tableBody) {
    if (!Array.isArray(data) || !slotMapping) {
        console.warn("Invalid data or slot mapping!");
        return;
    }

    table.innerHTML = ""; 

    data.forEach(row => {
        const tr = document.createElement("tr");

        ["Slot", "M", "T", "W", "Th", "F"].forEach(key => {
            const td = document.createElement("td");
            const slot = row[key]?.trim();

            if (slot && slotMapping[slot]) {
                const courses = slotMapping[slot];
                
                if (courses.length > 1) {
                    td.innerHTML = courses
                    .map(course => {
                        const color = courseColors[course.replace(/\s*\(.*?\)\s*/g, "").trim()] || "#FFFFFF"; 
                        return `<div class="conflict-course" style="background-color:${color};">${course}</div>`;
                    })
                    .join("");
                    td.classList.add("conflict-cell");
                } else {
                    td.textContent = courses[0];
                    td.style.backgroundColor = courseColors[courses[0].replace(/\s*\(.*?\)\s*/g, "").trim()];
                }
            } else if (slot.match(/[A-Z][0-9]/)){
                td.textContent= "";
            }
            else {
                td.textContent = row[key] || "";
            }

            tr.appendChild(td);
        });

        table.appendChild(tr);
    });
}

function downloadTableAsExcel(sheetName = "TimeTable") {
    
    const firstHalfData = filterCoursesByHalf(selectedData, "First Half");
    const secondHalfData = filterCoursesByHalf(selectedData, "Second Half");
    
    const firstHalfSlotMapping = mapCoursesToSlots(firstHalfData);
    const secondHalfSlotMapping = mapCoursesToSlots(secondHalfData);

    function createTableWithHeader(slotMapping) {
        const table = document.createElement("table");
        
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["Slot", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].forEach(header => {
            const th = document.createElement("th");
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
  
        const tbody = document.createElement("tbody");
        timeSlotsData.forEach(row => {
            const tr = document.createElement("tr");
            ["Slot", "M", "T", "W", "Th", "F"].forEach(key => {
                const td = document.createElement("td");
                const slot = row[key]?.trim();
                if (slot && slotMapping[slot]) {
                    const courses = slotMapping[slot];
                    td.textContent = courses.length > 1 ? courses.join(",") : courses[0];
                }  else if (slot.match(/[A-Z][0-9]/)){
                    td.textContent= "";
                }
                else {
                td.textContent = row[key] || "";
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        return table;
    }
    
    const firstHalfTable = createTableWithHeader(firstHalfSlotMapping);
    const secondHalfTable = createTableWithHeader(secondHalfSlotMapping);
    
    const workbook = XLSX.utils.book_new();
    const firstHalfSheet = XLSX.utils.table_to_sheet(firstHalfTable);
    const secondHalfSheet = XLSX.utils.table_to_sheet(secondHalfTable);

    XLSX.utils.book_append_sheet(workbook, firstHalfSheet, "First Half");
    XLSX.utils.book_append_sheet(workbook, secondHalfSheet, "Second Half");

    
    firstHalfSheet["!cols"] = secondHalfSheet["!cols"] = [
        { wch: 12 },
        { wch: 42 },
        { wch: 42 },
        { wch: 42 },
        { wch: 42 },
        { wch: 42 }
    ];
    
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    
    const formData = new FormData();
    formData.append("file", blob, `${sheetName}.xlsx`);

    fetch("/process-excel", {
        method: "POST",
        body: formData,
    })
        .then(response => {
            if (!response.ok) throw new Error("Failed to process file");
            return response.blob();
        })
        .then(processedBlob => {
            
            const url = window.URL.createObjectURL(processedBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${sheetName}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => console.error("Error processing Excel file:", error));
}

document.getElementById("downloadExcelButton").addEventListener("click", () => {
    downloadTableAsExcel();
});

document.addEventListener("DOMContentLoaded", () => {
    if (typeof selectedData !== "undefined" && typeof timeSlotsData !== "undefined") {
        const firstHalfData = filterCoursesByHalf(selectedData, "First Half");
        const secondHalfData = filterCoursesByHalf(selectedData, "Second Half");

        const firstHalfSlotMapping = mapCoursesToSlots(firstHalfData);
        const secondHalfSlotMapping = mapCoursesToSlots(secondHalfData);
        
        renderTableWithConflicts(timeSlotsData, firstHalfSlotMapping);

        const firstHalfButton = document.getElementById("firstHalfButton");
        const secondHalfButton = document.getElementById("secondHalfButton");

        firstHalfButton.addEventListener("click", () => {
            renderTableWithConflicts(timeSlotsData, firstHalfSlotMapping);
        });

        secondHalfButton.addEventListener("click", () => {
            renderTableWithConflicts(timeSlotsData, secondHalfSlotMapping);
        });
    } else {
        console.warn("Data not loaded!");
    }
});
