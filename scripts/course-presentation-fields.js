const coursePresentationFields = [
  { field: "subtitle", type: "text", meta: { interface: "textarea", note: "Short value proposition displayed in the course hero." } },
  { field: "cpe_hours", type: "decimal", meta: { interface: "input", note: "Texas CPE credit hours awarded for this course." } },
  { field: "estimated_duration", type: "string", meta: { interface: "input", options: { placeholder: "Approximately 60 Minutes" } } },
  { field: "delivery_format", type: "string", meta: { interface: "input", options: { placeholder: "Self-Paced" } } },
  { field: "instructor", type: "string", meta: { interface: "input", options: { placeholder: "Dr. Name, relevant credentials" } } },
  { field: "cta_label", type: "string", schema: { default_value: "Enroll and Start Now" }, meta: { interface: "input", options: { placeholder: "Enroll and Start Now" } } },
  { field: "benefit_heading", type: "string", meta: { interface: "input", note: "Heading displayed above the course benefit cards.", options: { placeholder: "Walk away with strategies you can use tomorrow" } } },
  { field: "benefit_description", type: "text", meta: { interface: "textarea", note: "Short supporting copy displayed above the course benefit cards." } },
  { field: "benefits", type: "json", meta: { interface: "tags", note: "Add exactly three short course outcomes. Only the first three are displayed." } },
];

module.exports = { coursePresentationFields };
