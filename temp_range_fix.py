from pathlib import Path
path = Path('apps/web/components/tasks/TasksPage.tsx')
text = path.read_text()
start = text.index('const appliedRange')
first_platform = text.index('const platformLabelMap')
block = text[start:first_platform]
new_block = """
  const appliedRange = overview?.metadata.appliedFilters.range ?? null;

  const rangeLabel = appliedRange

    ? ${FULL_DATE_FORMATTER.format(new Date(appliedRange.start))} - 

    : "Sem filtro de periodo";

"""
text = text[:start] + new_block + text[first_platform:]
path.write_text(text)
