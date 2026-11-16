/** create row name workflow — list shows plain text; rename lives in Edit. */
export function createRowNameController({
  fallbackNameFor,
}) {
  function createRowName(binding, index) {
    const fallbackName = fallbackNameFor(binding, index);
    const nameField = document.createElement("div");
    nameField.className = "binding-name";
    nameField.textContent = binding.name?.trim() || fallbackName;
    return { nameInput: null, nameField };
  }

  return { createRowName };
}
