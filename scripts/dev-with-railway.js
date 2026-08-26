const { spawn } = require("child_process");
const { coursePresentationFields } = require("./course-presentation-fields");

const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL;
const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
const localAppUrl = process.env.LOCAL_APP_URL || "http://localhost:3000";

if (!directusUrl || !adminToken) {
  console.error("Missing Directus configuration. Run this command through Railway CLI.");
  process.exit(1);
}

const catalogUrl = new URL("/items/Courses", directusUrl);
catalogUrl.searchParams.set("filter[is_published][_eq]", "true");
catalogUrl.searchParams.set("fields", "id,title");

async function syncCoursePresentationFields() {
  const response = await fetch(new URL("/fields/Courses", directusUrl), {
    headers: { Authorization: `Bearer ${adminToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Directus schema check failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const existingFields = new Set((payload.data || []).map(({ field }) => field));
  const missingFields = coursePresentationFields.filter(({ field }) => !existingFields.has(field));

  for (const field of missingFields) {
    const createResponse = await fetch(new URL("/fields/Courses", directusUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(field),
    });

    if (!createResponse.ok) {
      throw new Error(`Could not create Directus field Courses.${field.field} (status ${createResponse.status}).`);
    }
  }

  const label = missingFields.length === 1 ? "field" : "fields";
  console.log(`Directus course schema is current (${missingFields.length} ${label} added).`);
}

async function syncInstructorPhotoRelation() {
  const relationUrl = new URL("/relations/Courses/instructor_photo", directusUrl);
  const relationResponse = await fetch(relationUrl, {
    headers: { Authorization: `Bearer ${adminToken}` },
    cache: "no-store",
  });

  if (relationResponse.ok) {
    return;
  }

  if (relationResponse.status !== 404) {
    throw new Error(`Directus relation check failed with status ${relationResponse.status}.`);
  }

  const createResponse = await fetch(new URL("/relations", directusUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      collection: "Courses",
      field: "instructor_photo",
      related_collection: "directus_files",
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Could not create Directus relation Courses.instructor_photo (status ${createResponse.status}).`);
  }

  console.log("Directus instructor photo relation added.");
}

async function start() {
  await syncCoursePresentationFields();
  await syncInstructorPhotoRelation();

  const response = await fetch(catalogUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Directus catalog check failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const courses = Array.isArray(payload.data) ? payload.data : [];
  const label = courses.length === 1 ? "course" : "courses";

  console.log(`Loaded ${courses.length} published ${label} from Directus.`);
  console.log(`Local app URL: ${localAppUrl}`);

  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev"], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: localAppUrl,
    },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
