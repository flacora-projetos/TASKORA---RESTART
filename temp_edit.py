from pathlib import Path
path = Path('apps/web/components/dashboard/TaskListCard.tsx')
text = path.read_text()
old = """
                      <div className=\"flex items-start justify-between gap-3\">
                        <div>
                          <p className=\"text-sm font-semibold text-deepGreen\">{task.title}</p>
                          <p className=\"text-xs text-deepGreen/60\">
                            {assigneeNames ? Responsveis:  : \"Sem responsveis\"}
                          </p>
                        </div>
                        <span
"""
new = """
                      <div className=\"flex items-start justify-between gap-3\">
                        <div>
                          <p className=\"text-sm font-semibold text-deepGreen\">{task.title}</p>
                          <p className=\"text-xs text-deepGreen/60\">
                            {projectName ? Projeto:  : \"Projeto nao informado\"}
                          </p>
                          <p className=\"text-xs text-deepGreen/60\">
                            {assigneeNames ? Responsaveis:  : \"Sem responsaveis\"}
                          </p>
                        </div>
                        <span
"""
if old not in text:
    raise SystemExit('pattern not found')
path.write_text(text.replace(old, new))
