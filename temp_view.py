from pathlib import Path
lines = Path('apps/web/components/dashboard/TaskListCard.tsx').read_text().splitlines()
start=620; end=655
for i in range(start,end):
    print(f"{i}: {lines[i]}")
