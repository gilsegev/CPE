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
  { field: "learning_objectives", type: "json", meta: { interface: "tags", note: "Add three to five concise learning objectives. Only the first five are displayed." } },
  {
    field: "course_contents",
    type: "json",
    schema: {
      default_value: [
        { title: "Breaking Down ADHD", duration_minutes: 45, description: "Learn how ADHD affects attention, executive functioning, and behavior in the classroom." },
        { title: "Knowledge Check", duration_minutes: 10, description: "Confirm your understanding of the course's key concepts and classroom strategies." },
        { title: "Course Evaluation and Certificate", duration_minutes: 5, description: "Share course feedback and complete the requirements for your CPE certificate." },
      ],
    },
    meta: {
      interface: "list",
      note: "Public, non-clickable course outline. Add a title, duration in minutes, and one-line description for each activity.",
      options: {
        template: "{{ title }} — {{ duration_minutes }} minutes",
        fields: [
          { field: "title", name: "Title", type: "string", meta: { interface: "input", required: true, width: "half" } },
          { field: "duration_minutes", name: "Duration (minutes)", type: "integer", meta: { interface: "input", required: true, width: "half" } },
          { field: "description", name: "One-line description", type: "text", meta: { interface: "textarea", required: true, width: "full" } },
        ],
      },
    },
  },
];

module.exports = { coursePresentationFields };
