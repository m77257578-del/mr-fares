async function checkAdmin() {

  const response =
    await fetch("/api/auth/me");

  const data =
    await response.json();

  if (
    !data.user ||
    data.user.role !== "admin"
  ) {
    window.location.href = "/";
  }

}

async function loadStats() {

  const response =
    await fetch("/api/admin/students");

  const students =
    await response.json();

  document
    .getElementById("studentsCount")
    .textContent =
    students.length;

}

async function loadStudents() {

  const response =
    await fetch("/api/admin/students");

  const students =
    await response.json();

  const container =
    document.getElementById(
      "studentsTable"
    );

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>الاسم</th>
          <th>الإيميل</th>
          <th>الهاتف</th>
          <th>الصف</th>
        </tr>
      </thead>

      <tbody>

        ${students.map(student => `

          <tr>

            <td>
              ${escapeHtml(student.name)}
            </td>

            <td>
              ${escapeHtml(student.email)}
            </td>

            <td>
              ${escapeHtml(student.phone || "")}
            </td>

            <td>
              ${escapeHtml(student.grade || "")}
            </td>

          </tr>

        `).join("")}

      </tbody>
    </table>
  `;

}

document
  .getElementById("courseForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(event.target);

      const body =
        Object.fromEntries(form);

      const response =
        await fetch(
          "/api/admin/courses",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(body)
          }
        );

      const result =
        await response.json();

      alert(
        result.success
          ? "تم إنشاء الكورس ✅"
          : result.message
      );

      event.target.reset();

    }
  );

document
  .getElementById("lessonForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(event.target);

      const response =
        await fetch(
          "/api/admin/lessons",
          {
            method: "POST",
            body: form
          }
        );

      const result =
        await response.json();

      alert(
        result.success
          ? "تم نشر الدرس ✅"
          : result.message
      );

    }
  );

document
  .getElementById("codeForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(event.target);

      const body =
        Object.fromEntries(form);

      const response =
        await fetch(
          "/api/admin/codes/generate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(body)
          }
        );

      const result =
        await response.json();

      document
        .getElementById(
          "generatedCodes"
        )
        .textContent =
        result.codes
          ? result.codes.join("\n")
          : result.message;

    }
  );

document
  .getElementById("examForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(event.target);

      const body =
        Object.fromEntries(form);

      const response =
        await fetch(
          "/api/admin/exams",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(body)
          }
        );

      const result =
        await response.json();

      alert(
        result.success
          ? `تم إنشاء الامتحان. ID = ${result.examId}`
          : result.message
      );

    }
  );

document
  .getElementById("questionForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(event.target);

      const body =
        Object.fromEntries(form);

      const response =
        await fetch(
          "/api/admin/questions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(body)
          }
        );

      const result =
        await response.json();

      alert(
        result.success
          ? "تم حفظ السؤال ✅"
          : result.message
      );

    }
  );

document
  .getElementById("announcementForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(event.target);

      const body =
        Object.fromEntries(form);

      const response =
        await fetch(
          "/api/admin/announcements",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(body)
          }
        );

      const result =
        await response.json();

      alert(
        result.success
          ? "تم نشر الإشعار ✅"
          : result.message
      );

      event.target.reset();

    }
  );

function openAdmin(id) {

  document
    .querySelectorAll(".admin-section")
    .forEach(section => {
      section.style.display =
        "none";
    });

  document.getElementById(id)
    .style.display = "block";

  if (id === "students") {
    loadStudents();
  }

}

async function logout() {

  await fetch(
    "/api/auth/logout",
    {
      method: "POST"
    }
  );

  window.location.href = "/";
}

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}

checkAdmin();
loadStats();