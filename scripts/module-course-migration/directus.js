function createDirectusClient() {
  const baseUrl = (process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.DIRECTUS_URL || "").replace(/\/$/, "");
  const token = process.env.DIRECTUS_ADMIN_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("NEXT_PUBLIC_DIRECTUS_URL (or DIRECTUS_URL) and DIRECTUS_ADMIN_TOKEN are required");
  }

  async function request(path, method = "GET", body) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`${method} ${path} failed (${response.status}): ${await response.text()}`);
    }
    if (response.status === 204) return null;
    return (await response.json()).data;
  }

  async function listAll(collection, fields = "*") {
    const query = new URLSearchParams({ fields, limit: "-1" });
    return request(`/items/${collection}?${query}`);
  }

  return { request, listAll };
}

async function readInventory(client) {
  const [courses, modules, quizzes, questions, userProgress, quizProgress, submissions, certificates] = await Promise.all([
    client.listAll("Courses", "id,title,cpe_hours,is_published,structure_version"),
    client.listAll("Modules", "id,course_id,title,order_index,type,cpe_value,migration_status"),
    client.listAll("Quizzes", "id,module_id,passing_score,is_enabled"),
    client.listAll("Questions", "id,quiz_id,question_text,options,correct_answer_index,explanation,order_index"),
    client.listAll("UserProgress", "id,user_id,module_id,is_completed,content_completed_at,quiz_passed_at,completed_at"),
    client.listAll("QuizProgress", "id,user_id,module_id,answers,is_completed"),
    client.listAll("Submissions", "id,user_id,course_id,status"),
    client.listAll("Certificates", "id,user_id,course_id,pdf_url,issued_date,completion_id,status"),
  ]);
  return { courses, modules, quizzes, questions, userProgress, quizProgress, submissions, certificates };
}

module.exports = { createDirectusClient, readInventory };
