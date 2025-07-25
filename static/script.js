const tableBody = document.getElementById("tableBody");
const proceedButton = document.getElementById("proceedButton");
const summarySection = document.getElementById("summarySection");
const backButton = document.getElementById("backButton");
const exportButton = document.getElementById("exportButton");
const searchBar = document.getElementById("searchBar");

const headers = [
    "S ", "Course Name", "L", "T", "P", "C",
    "Name of the Instructors and Tutors", "Lecture", "Tutorial", "Lab", "HSS/BS elective"
];

function sortData() {
    tableData.sort((a, b) => {
        if (a.priority === -1 && b.priority !== -1) return 1;
        if (b.priority === -1 && a.priority !== -1) return -1;
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (b.searched !== a.searched) return b.searched - a.searched;
        return a.index - b.index;
    });
}

function toggleSelection(row) {
    row.priority = row.priority > -1 ? -1 : Math.max(...tableData.map(r => r.priority > -1 ? r.priority : 0)) + 1;
    renderTable();
}

function extractSlotsFromJSON(courseData) {
    const slotColumns = ["Lecture", "Tutorial", "Lab"];
    return slotColumns.flatMap(colName => {
        const cellContent = courseData[colName]?.trim();
        return cellContent ? (cellContent.match(/[A-Z]\d+/g) || []) : [];
    });
}

function renderRow(row, occupiedSlots, isSummary) {
    const tr = document.createElement("tr");

    if (!isSummary) {
        tr.addEventListener("click", event => {
            if (event.target.type !== "checkbox") toggleSelection(row);
        });
    }

    headers.forEach(key => {
        const td = document.createElement("td");
        if (isSummary && ["Lecture", "Tutorial", "Lab"].includes(key)) {
            td.contentEditable = true;
            td.textContent = row[key];
            td.addEventListener("blur", () => {
                row[key] = td.textContent.trim();
                renderClashSummary(getOccupiedSlots());
            });
        } else {
            td.textContent = row[key];
        }
        tr.appendChild(td);
    });

    if (!isSummary && row.priority > -1) tr.classList.add("highlight2");
    if (!isSummary && row.searched === 1) tr.classList.add("highlight");

    if (!isSummary && row.priority === -1) {
        const rowSlots = extractSlotsFromJSON(row);
        if (rowSlots.some(slot => occupiedSlots.includes(slot))) tr.classList.add("strike-through");
    }

    tableBody.appendChild(tr);
}

function renderTable(isSummary = false) {
    sortData();
    tableBody.innerHTML = "";
    const occupiedSlots = getOccupiedSlots();
    tableData.forEach(row => {
        if (isSummary && row.priority === -1) return;
        renderRow(row, occupiedSlots, isSummary);
    });
    if (isSummary) renderClashSummary(occupiedSlots);
}

function getOccupiedSlots() {
    return tableData.filter(row => row.priority > -1).flatMap(row => extractSlotsFromJSON(row));
}

function filterCoursesByHalf(selectedData, halfType) {
    return selectedData.filter(course => {
        const courseName = course["Course Name"];
        if (courseName.includes(halfType)) return true;
        return !courseName.includes("First Half") && !courseName.includes("Second Half");
    });
}

function renderClashSummary(occupiedSlots) {
    const selectedCourses = tableData.filter(row => row.priority > -1);
    const firstHalfData = filterCoursesByHalf(selectedCourses, "First Half");
    const secondHalfData = filterCoursesByHalf(selectedCourses, "Second Half");
    const clashes = [];

    function findClashes(data) {
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                const slots1 = extractSlotsFromJSON(data[i]);
                const slots2 = extractSlotsFromJSON(data[j]);
                const intersectingSlots = slots1.filter(slot => slots2.includes(slot));
                const clashElement={
                    course1: data[i]["Course Name"],
                    course2: data[j]["Course Name"],
                    slots: intersectingSlots
                };
                if (intersectingSlots.length > 0 && !clashes.some(clash => 
                    clash.course1 === clashElement.course1 && 
                    clash.course2 === clashElement.course2 && 
                    clash.slots.join() === clashElement.slots.join())) {
                    clashes.push(clashElement);
                }
            }
        }
    }

    findClashes(firstHalfData);
    findClashes(secondHalfData);

    summarySection.innerHTML = `
        <p>* Make sure to personalize the timetable by changing the slots and venues to the ones assigned to you, but do not mess with the format i.e. Slot (Venue) for eg. P1 (7/101)</p>
        <h3>Clash Summary</h3>
        ${clashes.length > 0
            ? `<ul>${clashes.map(clash => `
                <li>
                    <strong>${clash.course1}</strong> clashes with <strong>${clash.course2}</strong> due to slots: 
                    <em>${clash.slots.join(", ")}</em>
                </li>`).join("")}</ul>`
            : "<p>No clashes detected among selected courses.</p>"
        }
    `;
}

function searchTable(query) {
    const lowerQuery = query.toLowerCase();
    tableData.forEach(row => {
        row.searched = query.trim() && headers.some(key => {
            const cellValue = row[key];
            return typeof cellValue === "string" && cellValue.toLowerCase().includes(lowerQuery);
        }) ? 1 : 0;
    });
    renderTable();
}

function resetSearch() {
    searchBar.value = "";
    tableData.forEach(row => (row.searched = 0));
    renderTable();
}

function extractSelectedCoursesAsJSON() {
    const selectedCourses = tableData.filter(row => row.priority > -1).map(row => {
        const selectedData = {};
        headers.forEach(header => {
            selectedData[header] = row[header];
        });
        return selectedData;
    });
    return JSON.stringify(selectedCourses, null, 2);
}

exportButton.addEventListener("click", () => {
    const selectedCoursesJSON = extractSelectedCoursesAsJSON();
    fetch("/save_selected_courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: selectedCoursesJSON,
    })
        .then(response => {
            if (response.ok) window.location.href = "/timetable";
        })
        .catch(err => console.error("Error saving courses:", err));
});

backButton.addEventListener("click", () => {
    document.getElementById("searchSection").style.display = "block";
    proceedButton.style.display = "block";
    summarySection.style.display = "none";
    exportButton.style.display = "none";
    backButton.style.display = "none";
    renderTable();
});

proceedButton.addEventListener("click", () => {
    document.getElementById("searchSection").style.display = "none";
    proceedButton.style.display = "none";
    summarySection.style.display = "block";
    exportButton.style.display = "block";
    backButton.style.display = "block";
    renderTable(true);
});

renderTable();
