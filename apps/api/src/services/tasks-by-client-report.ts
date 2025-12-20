import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PDFDocument from "pdfkit";
import type * as PDFKit from "pdfkit";
type PDFKitDocument = PDFKit.PDFDocument;

import { SUMMARY_TASK_TYPES, TASK_TYPE_LABELS } from "../constants/tasks.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getTasksRepository } from "../repositories/tasks-repository.js";
import { getTeamMembersRepository } from "../repositories/team-members-repository.js";
import type { TaskEntity, TaskType } from "../types/tasks.js";
import type { AuthenticatedUser } from "./auth.js";
import { listOrganizationsForUser } from "./organizations.js";

export type TaskByClientReportMode = "summary" | "all";

export type TaskByClientReportTask = {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  completedAt: string;
  projectId: string;
  projectName: string | null;
  assignees: Array<{ id: string; name: string }>;
};

export type TaskByClientReportClient = {
  clientId: string;
  clientName: string;
  tasks: TaskByClientReportTask[];
};

export type TaskByClientReport = {
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  period: { start: string; end: string };
  mode: TaskByClientReportMode;
  filters: { types: TaskType[] | null };
  generatedAt: string;
  totals: { clients: number; tasks: number };
  clients: TaskByClientReportClient[];
};

export type TaskByClientReportInput = {
  periodStart: Date;
  periodEnd: Date;
  mode: TaskByClientReportMode;
  types: TaskType[] | null;
};

type TaskByClientReportLayoutTask = {
  date: Date;
  type: TaskType;
  title: string;
  projectName: string | null;
  assignees: string[];
  description: string | null;
};

type TaskByClientReportLayoutClient = {
  clientName: string;
  summaryByType: Array<{ type: TaskType; count: number }>;
  tasks: TaskByClientReportLayoutTask[];
};

type TaskByClientReportLayout = {
  orgName: string;
  orgSlug: string | null;
  period: { start: Date; end: Date };
  mode: TaskByClientReportMode;
  types: TaskType[] | null;
  generatedAt: Date;
  clients: TaskByClientReportLayoutClient[];
};

const tasksRepository = getTasksRepository();
const projectsRepository = getProjectsRepository();
const clientsRepository = getClientsRepository();
const teamMembersRepository = getTeamMembersRepository();

const ORG_LOGO_FILES: Record<string, string> = {
  dacora: "dacora.png",
  "org-dev": "dacora.png",
  allgrotech: "allgrotech.png"
};

const PDF_LABELS = {
  title: "Relat\u00f3rio de Entregas por Cliente",
  headerShort: "Relat\u00f3rio de Entregas",
  organization: "Organiza\u00e7\u00e3o",
  period: "Per\u00edodo",
  mode: "Modo",
  types: "Tipos",
  summary: "Resumo",
  project: "Projeto",
  assignees: "Respons\u00e1veis",
  notes: "Observa\u00e7\u00f5es",
  links: "Links",
  emptyClient: "Sem entregas no periodo."
};

const TASK_TYPE_LABELS_PDF: Record<TaskType, string> = {
  optimization: "Otimiza\u00e7\u00e3o",
  report: "Relat\u00f3rio",
  creative: "Criativo",
  meeting: "Reuni\u00e3o",
  feedback: "Feedback",
  campaign: "Campanha",
  billing: "Boleto",
  note: "Nota",
  other: "Outros"
};

const TASK_TYPE_LABELS_PLURAL_PDF: Record<TaskType, string> = {
  optimization: "Otimiza\u00e7\u00f5es",
  report: "Relat\u00f3rios",
  creative: "Criativos",
  meeting: "Reuni\u00f5es",
  feedback: "Feedbacks",
  campaign: "Campanhas",
  billing: "Boletos",
  note: "Notas",
  other: "Outros"
};

const PDF_STYLES = {
  text: "#111827",
  muted: "#6B7280",
  light: "#9CA3AF",
  divider: "#E5E7EB",
  accent: "#2563EB"
};

const URL_PATTERN = /\bhttps?:\/\/[^\s)]+/gi;
const TRAILING_PUNCTUATION = /[)\],.;!?]+$/;
const BULLET_PATTERN = /[•·▪–—]/g;
const STRANGE_CHAR_PATTERN = /[^\t\n\r\x20-\x7E]/g;

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(CURRENT_DIR, "..", "assets", "org-logos");

function resolveCompletedAt(task: TaskEntity): string | null {
  const logs = [...task.activityLog].reverse();
  const statusLog = logs.find(
    (entry) =>
      entry.type === "status_change" &&
      entry.metadata &&
      entry.metadata["to"] === "done"
  );
  if (statusLog) {
    return statusLog.createdAt;
  }
  return task.status === "done" ? task.updatedAt : null;
}

function resolveAssigneeLabel(assigneeId: string, memberIndex: Map<string, string>): string {
  const resolved = memberIndex.get(assigneeId);
  if (resolved && resolved.trim().length > 0 && resolved !== assigneeId) {
    return resolved;
  }
  return `Usuario desconhecido (${assigneeId})`;
}

function formatDateBr(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = String(parsed.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function formatModeLabel(mode: TaskByClientReportMode): string {
  return mode === "summary" ? "Resumo" : "Todas as tarefas";
}

function resolveTaskTypeLabel(type: TaskType): string {
  return TASK_TYPE_LABELS_PDF[type] ?? TASK_TYPE_LABELS[type] ?? type;
}

function buildTypesLabel(types: TaskType[] | null, mode: TaskByClientReportMode): string {
  if (types && types.length > 0) {
    return types.map(resolveTaskTypeLabel).join(", ");
  }
  return mode === "summary" ? "Principais" : "Todos";
}

function escapeCsvValue(value: string): string {
  if (value.includes("\"") || value.includes(";") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function resolveLogoPath(orgId: string, orgSlug: string | null): string | null {
  const key = (orgSlug ?? orgId).toLowerCase();
  const fileName = ORG_LOGO_FILES[key] ?? ORG_LOGO_FILES[orgId.toLowerCase()] ?? null;
  if (!fileName) {
    return null;
  }
  const candidate = path.join(ASSETS_DIR, fileName);
  return fs.existsSync(candidate) ? candidate : null;
}

async function resolveOrgMeta(user: AuthenticatedUser, orgId: string): Promise<{ name: string; slug: string | null }> {
  const orgs = await listOrganizationsForUser(user);
  const match = orgs.find((org) => org.id === orgId) ?? null;
  return {
    name: match?.name ?? orgId,
    slug: match?.slug ?? null
  };
}

function buildTasksByClientReportLayout(report: TaskByClientReport): TaskByClientReportLayout {
  const memberIndex = new Map<string, string>();
  report.clients.forEach((client) => {
    client.tasks.forEach((task) => {
      task.assignees.forEach((assignee) => {
        if (!memberIndex.has(assignee.id)) {
          memberIndex.set(assignee.id, assignee.name);
        }
      });
    });
  });

  const clients = report.clients.map((client) => {
    const tasks = client.tasks.map((task) => ({
      date: new Date(task.completedAt),
      type: task.type,
      title: task.title,
      projectName: task.projectName ?? null,
      assignees: task.assignees.map((assignee) => resolveAssigneeLabel(assignee.id, memberIndex)),
      description: task.description ?? null
    }));

    const summaryMap = new Map<TaskType, number>();
    tasks.forEach((task) => {
      summaryMap.set(task.type, (summaryMap.get(task.type) ?? 0) + 1);
    });

    const summaryByType = Array.from(summaryMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      clientName: client.clientName,
      summaryByType,
      tasks
    };
  });

  return {
    orgName: report.orgName,
    orgSlug: report.orgSlug,
    period: {
      start: new Date(report.period.start),
      end: new Date(report.period.end)
    },
    mode: report.mode,
    types: report.filters.types ?? null,
    generatedAt: new Date(report.generatedAt),
    clients
  };
}

function splitTrailingPunctuation(value: string): { url: string; trailing: string } {
  const match = value.match(TRAILING_PUNCTUATION);
  if (!match) {
    return { url: value, trailing: "" };
  }
  const trailing = match[0] ?? "";
  return { url: value.slice(0, -trailing.length), trailing };
}

function replaceLinksWithLabels(text: string): { text: string; links: string[] } {
  let index = 0;
  const links: string[] = [];
  const replaced = text.replace(URL_PATTERN, (match) => {
    const { url, trailing } = splitTrailingPunctuation(match);
    if (!url) {
      return match;
    }
    index += 1;
    links.push(url);
    const label = buildLinkLabel(url);
    return `${label}${trailing}`;
  });
  return { text: replaced, links };
}

function shortenUrlLabel(value: string, maxLength = 42): string {
  let label = value.replace(/^https?:\/\//i, "");
  try {
    const parsed = new URL(value);
    label = parsed.hostname + parsed.pathname;
  } catch {
    // Keep fallback label.
  }
  if (label.length > maxLength) {
    return `${label.slice(0, maxLength - 3)}...`;
  }
  return label;
}

function buildLinkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("instagram.com")) {
      return "[Ver criativo no Instagram]";
    }
    if (host.includes("drive.google.com") || host.includes("docs.google.com")) {
      return "[Ver arquivo no Drive]";
    }
    if (host.includes("notion.so")) {
      return "[Ver no Notion]";
    }
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      return "[Ver no YouTube]";
    }
    if (host.includes("whatsapp.com") || host.includes("wa.me")) {
      return "[Abrir no WhatsApp]";
    }
    return "[Ver link]";
  } catch {
    return "[Ver link]";
  }
}

function wrapText(doc: PDFKitDocument, text: string, width: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let line = "";
    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;
      if (doc.widthOfString(nextLine) <= width) {
        line = nextLine;
        continue;
      }

      if (line) {
        lines.push(line);
        line = "";
      }

      if (doc.widthOfString(word) <= width) {
        line = word;
        continue;
      }

      let chunk = "";
      for (const char of word) {
        const candidate = chunk + char;
        if (doc.widthOfString(candidate) <= width) {
          chunk = candidate;
          continue;
        }
        if (chunk) {
          lines.push(chunk);
        }
        chunk = char;
      }
      line = chunk;
    }

    if (line) {
      lines.push(line);
    }

    if (paragraphIndex < paragraphs.length - 1) {
      lines.push("");
    }
  });

  return lines;
}

function buildDescriptionPreview(
  doc: PDFKitDocument,
  raw: string,
  width: number,
  maxLines: number
): { lines: string[]; links: string[]; truncated: boolean } {
  const normalized = raw
    .replace(BULLET_PATTERN, "- ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(STRANGE_CHAR_PATTERN, " ");
  const trimmed = normalized.trim();
  if (!trimmed) {
    return { lines: [], links: [], truncated: false };
  }
  const replaced = replaceLinksWithLabels(trimmed);
  const lines = wrapText(doc, replaced.text, width);
  if (lines.length <= maxLines) {
    return { lines, links: replaced.links, truncated: false };
  }
  const trimmedLines = lines.slice(0, maxLines);
  const lastIndex = trimmedLines.length - 1;
  trimmedLines[lastIndex] = `${trimmedLines[lastIndex].trimEnd()} [...] (texto completo no Taskora)`;
  return { lines: trimmedLines, links: replaced.links, truncated: true };
}

export async function getTasksByClientReport(
  orgId: string,
  user: AuthenticatedUser,
  input: TaskByClientReportInput
): Promise<TaskByClientReport> {
  const [tasks, projects, clients, teamMembers, orgMeta] = await Promise.all([
    tasksRepository.listAll(orgId),
    projectsRepository.list(orgId),
    clientsRepository.list(orgId),
    teamMembersRepository.list(orgId),
    resolveOrgMeta(user, orgId)
  ]);

  const projectIndex = new Map(projects.map((project) => [project.id, project]));
  const clientIndex = new Map(clients.map((client) => [client.id, client]));

  const memberIndex = new Map(
    teamMembers.map((member) => [member.id, member.name ?? member.userId ?? member.id])
  );

  const typesFilter = input.types ? new Set(input.types) : null;
  const summaryFilter = new Set(SUMMARY_TASK_TYPES);

  const grouped = new Map<string, TaskByClientReportClient>();
  let totalTasks = 0;

  for (const task of tasks) {
    if (task.status !== "done") {
      continue;
    }

    const completedAt = resolveCompletedAt(task);
    if (!completedAt) {
      continue;
    }

    const completedDate = new Date(completedAt);
    if (Number.isNaN(completedDate.getTime())) {
      continue;
    }

    if (completedDate < input.periodStart || completedDate > input.periodEnd) {
      continue;
    }

    if (typesFilter && !typesFilter.has(task.type)) {
      continue;
    }

    if (!typesFilter && input.mode === "summary" && !summaryFilter.has(task.type)) {
      continue;
    }

    const project = projectIndex.get(task.projectId);
    if (!project?.clientId) {
      continue;
    }

    const client = clientIndex.get(project.clientId);
    if (!client) {
      continue;
    }

    const assignees = task.assignees.map((assigneeId) => ({
      id: assigneeId,
      name: memberIndex.get(assigneeId) ?? assigneeId
    }));

    const entry: TaskByClientReportTask = {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      type: task.type,
      completedAt,
      projectId: task.projectId,
      projectName: project.name ?? null,
      assignees
    };

    const clientKey = client.id;
    const bucket = grouped.get(clientKey) ?? {
      clientId: client.id,
      clientName: client.name,
      tasks: []
    };
    bucket.tasks.push(entry);
    grouped.set(clientKey, bucket);
    totalTasks += 1;
  }

  const clientsSorted = Array.from(grouped.values())
    .map((client) => ({
      ...client,
      tasks: [...client.tasks].sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));

  return {
    orgId,
    orgName: orgMeta.name,
    orgSlug: orgMeta.slug,
    period: {
      start: input.periodStart.toISOString(),
      end: input.periodEnd.toISOString()
    },
    mode: input.mode,
    filters: {
      types: typesFilter ? Array.from(typesFilter) : null
    },
    generatedAt: new Date().toISOString(),
    totals: {
      clients: clientsSorted.length,
      tasks: totalTasks
    },
    clients: clientsSorted
  };
}

export function buildTasksByClientCsv(report: TaskByClientReport): string {
  const rows: string[][] = [];
  rows.push(["Relatorio de entregas por cliente"]);
  rows.push(["Organizacao", report.orgName]);
  rows.push(["Periodo", `${report.period.start} a ${report.period.end}`]);
  rows.push(["Modo", report.mode]);
  if (report.filters.types && report.filters.types.length > 0) {
    rows.push(["Tipos", report.filters.types.join(",")]);
  }
  rows.push([]);
  rows.push(["Cliente", "Projeto", "Conclusao", "Tipo", "Tarefa", "Responsaveis", "Briefing"]);

  report.clients.forEach((client) => {
    client.tasks.forEach((task) => {
      rows.push([
        client.clientName,
        task.projectName ?? "",
        task.completedAt,
        TASK_TYPE_LABELS[task.type] ?? task.type,
        task.title,
        task.assignees.map((assignee) => assignee.name).join(", "),
        task.description ?? ""
      ]);
    });
  });

  return rows.map((row) => row.map(escapeCsvValue).join(";")).join("\n");
}

export async function buildTasksByClientPdf(report: TaskByClientReport): Promise<Buffer> {
  const layout = buildTasksByClientReportLayout(report);
  const logoPath = resolveLogoPath(report.orgId, report.orgSlug);
  const logoBuffer = logoPath ? fs.readFileSync(logoPath) : null;
  return generateTasksByClientReportPdf(layout, logoBuffer);
}

function generateTasksByClientReportPdf(
  layout: TaskByClientReportLayout,
  logoBuffer: Buffer | null
): Promise<Buffer> {
  // PDF layout refinement: structured header/client blocks, truncated descriptions, per-page header/footer, logo.
  // Ref: Documentacao/Melhorias/prompt_codex_melhorar_visual_do_pdf_de_entregas_2.md.
  return new Promise((resolve, reject) => {
    const PAGE_MARGIN = 42;
    const HEADER_HEIGHT = 80;
    const FOOTER_HEIGHT = 32;
    const INDENT = 16;
    const DESCRIPTION_MAX_LINES = 3;
    const MAX_LINKS = 3;

    const doc = new PDFDocument({
      size: "A4",
      margins: {
        top: PAGE_MARGIN + HEADER_HEIGHT,
        bottom: PAGE_MARGIN + FOOTER_HEIGHT,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN
      },
      bufferPages: true
    });
    const chunks: Buffer[] = [];
    doc.lineGap(2);

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.info.Title = PDF_LABELS.title;
    doc.info.Author = "Taskora";
    doc.info.Subject = `${PDF_LABELS.headerShort} - ${layout.orgName}`;

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const contentBottom = () => doc.page.height - doc.page.margins.bottom;

    const resetContentCursor = () => {
      const headerStartY = doc.page.margins.top - HEADER_HEIGHT;
      const headerBottom = headerStartY + HEADER_HEIGHT;
      doc.y = headerBottom + 14;
    };

    const ensureSpace = (height: number) => {
      if (doc.y + height > contentBottom()) {
        doc.addPage();
        resetContentCursor();
      }
    };

    const drawHeader = () => {
      const headerStartY = doc.page.margins.top - HEADER_HEIGHT;
      const logoWidth = 140;
      const logoHeight = 52;
      const logoGap = 14;
      let headerTextX = left;
      let headerTextWidth = contentWidth;

      if (logoBuffer) {
        doc.image(logoBuffer, left, headerStartY + 4, { fit: [logoWidth, logoHeight] });
        headerTextX = left + logoWidth + logoGap;
        headerTextWidth = contentWidth - logoWidth - logoGap;
      }

      doc.font("Helvetica-Bold").fontSize(17).fillColor(PDF_STYLES.text);
      doc.text(PDF_LABELS.title, headerTextX, headerStartY + 2, { width: headerTextWidth });

      doc.font("Helvetica").fontSize(10).fillColor(PDF_STYLES.muted);
      doc.text(`${PDF_LABELS.organization}: ${layout.orgName}`, headerTextX, headerStartY + 24, {
        width: headerTextWidth
      });
      doc.text(
        `${PDF_LABELS.period}: ${formatDateBr(layout.period.start)} a ${formatDateBr(layout.period.end)}`,
        headerTextX,
        headerStartY + 38,
        { width: headerTextWidth }
      );
      doc.text(`${PDF_LABELS.mode}: ${formatModeLabel(layout.mode)}`, headerTextX, headerStartY + 52, {
        width: headerTextWidth
      });

      doc.font("Helvetica").fontSize(9).fillColor(PDF_STYLES.light);
      doc.text(`${PDF_LABELS.types}: ${buildTypesLabel(layout.types, layout.mode)}`, headerTextX, headerStartY + 66, {
        width: headerTextWidth
      });

      const headerBottom = headerStartY + HEADER_HEIGHT;
      doc
        .moveTo(left, headerBottom + 6)
        .lineTo(left + contentWidth, headerBottom + 6)
        .strokeColor(PDF_STYLES.divider)
        .stroke();
    };

    const drawFooter = (pageIndex: number, total: number) => {
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = PAGE_MARGIN;

      const footerY = doc.page.height - PAGE_MARGIN - 10;
      doc
        .moveTo(left, footerY - 14)
        .lineTo(left + contentWidth, footerY - 14)
        .strokeColor(PDF_STYLES.divider)
        .stroke();

      doc.font("Helvetica").fontSize(8).fillColor(PDF_STYLES.light);
      doc.text(
        `${PDF_LABELS.headerShort} - ${layout.orgName}  |  Pagina ${pageIndex + 1} de ${total}  |  Gerado em ${formatDateBr(layout.generatedAt)}`,
        left,
        footerY - 4,
        { width: contentWidth, align: "center", lineBreak: false }
      );

      doc.page.margins.bottom = originalBottomMargin;
    };

    resetContentCursor();

    const buildClientSummaryLine = (summary: Array<{ type: TaskType; count: number }>): string | null => {
      if (summary.length === 0) {
        return null;
      }
      return summary
        .map((item) => {
          const label = item.count === 1 ? resolveTaskTypeLabel(item.type) : TASK_TYPE_LABELS_PLURAL_PDF[item.type];
          return `${item.count} ${label}`;
        })
        .join(" | ");
    };

    const buildLinksLine = (links: string[]): string | null => {
      if (links.length === 0) {
        return null;
      }
      const visible = links.slice(0, MAX_LINKS).map((link) => shortenUrlLabel(link));
      if (links.length > MAX_LINKS) {
        visible.push(`+${links.length - MAX_LINKS} mais`);
      }
      return `${PDF_LABELS.links}: ${visible.join(" | ")}`;
    };

    const buildTaskBlock = (task: TaskByClientReportLayoutTask) => {
      const dateLabel = formatDateBr(task.date);
      const typeLabel = resolveTaskTypeLabel(task.type).toUpperCase();
      const titleLine = `${dateLabel} | ${typeLabel} | ${task.title}`;
      const projectLine = task.projectName ? `${PDF_LABELS.project}: ${task.projectName}` : null;
      const assigneesLine = task.assignees.length > 0 ? `${PDF_LABELS.assignees}: ${task.assignees.join(", ")}` : null;

      doc.font("Helvetica").fontSize(9);
      const description = task.description ? buildDescriptionPreview(doc, task.description, contentWidth - INDENT, DESCRIPTION_MAX_LINES) : null;
      const linksLine = description ? buildLinksLine(description.links) : null;

      return {
        titleLine,
        projectLine,
        assigneesLine,
        description,
        linksLine
      };
    };

    const measureTaskBlockHeight = (block: ReturnType<typeof buildTaskBlock>): number => {
      let height = 0;
      doc.font("Helvetica-Bold").fontSize(10);
      height += doc.heightOfString(block.titleLine, { width: contentWidth });

      doc.font("Helvetica").fontSize(9);
      if (block.projectLine) {
        height += doc.heightOfString(block.projectLine, { width: contentWidth - INDENT, indent: INDENT });
      }
      if (block.assigneesLine) {
        height += doc.heightOfString(block.assigneesLine, { width: contentWidth - INDENT, indent: INDENT });
      }
      if (block.description && block.description.lines.length > 0) {
        const descText = `${PDF_LABELS.notes}: ${block.description.lines.join("\n")}`;
        height += doc.heightOfString(descText, { width: contentWidth - INDENT, indent: INDENT });
      }
      if (block.linksLine) {
        doc.font("Helvetica").fontSize(8);
        height += doc.heightOfString(block.linksLine, { width: contentWidth - INDENT, indent: INDENT });
      }
      return height + 6;
    };

    const renderLinksLine = (links: string[], indent: number, width: number) => {
      if (links.length === 0) {
        return;
      }
      doc.font("Helvetica").fontSize(8).fillColor(PDF_STYLES.muted);
      doc.text(`${PDF_LABELS.links}: `, { indent, width, continued: true });
      const visible = links.slice(0, MAX_LINKS);
      visible.forEach((link, index) => {
        const label = shortenUrlLabel(link);
        doc.fillColor(PDF_STYLES.accent).text(label, { link, underline: true, continued: true });
        doc.fillColor(PDF_STYLES.muted);
        if (index < visible.length - 1) {
          doc.text(" | ", { continued: true });
        }
      });
      if (links.length > MAX_LINKS) {
        doc.text(` +${links.length - MAX_LINKS} mais`, { continued: false });
      } else {
        doc.text("", { continued: false });
      }
    };

    layout.clients.forEach((client, clientIndex) => {
      const summaryLine = buildClientSummaryLine(client.summaryByType);
      const minClientHeight = 36 + (summaryLine ? 12 : 0);
      ensureSpace(minClientHeight);

      doc.font("Helvetica-Bold").fontSize(14).fillColor(PDF_STYLES.text);
      doc.text(client.clientName);

      if (summaryLine) {
        doc.font("Helvetica").fontSize(9).fillColor(PDF_STYLES.muted);
        doc.text(`${PDF_LABELS.summary}: ${summaryLine}`);
      }

      if (client.tasks.length === 0) {
        doc.font("Helvetica").fontSize(9).fillColor(PDF_STYLES.light);
        doc.text(PDF_LABELS.emptyClient);
      } else {
        client.tasks.forEach((task) => {
          const block = buildTaskBlock(task);
          ensureSpace(measureTaskBlockHeight(block));

          doc.font("Helvetica-Bold").fontSize(10).fillColor(PDF_STYLES.text);
          doc.text(block.titleLine);

          doc.font("Helvetica").fontSize(9).fillColor(PDF_STYLES.muted);
          if (block.projectLine) {
            doc.text(block.projectLine, { indent: INDENT });
          }
          if (block.assigneesLine) {
            doc.text(block.assigneesLine, { indent: INDENT });
          }
          if (block.description && block.description.lines.length > 0) {
            const descText = `${PDF_LABELS.notes}: ${block.description.lines.join("\n")}`;
            doc.text(descText, { indent: INDENT });
          }
          if (block.description && block.description.links.length > 0) {
            renderLinksLine(block.description.links, INDENT, contentWidth - INDENT);
          } else if (block.linksLine) {
            doc.font("Helvetica").fontSize(8).fillColor(PDF_STYLES.muted);
            doc.text(block.linksLine, { indent: INDENT });
          }

          doc.moveDown(0.4);
        });
      }

      if (clientIndex < layout.clients.length - 1) {
        doc
          .moveTo(left, doc.y + 6)
          .lineTo(left + contentWidth, doc.y + 6)
          .strokeColor(PDF_STYLES.divider)
          .stroke();
        doc.moveDown(1.1);
      }
    });

    const buffered = doc.bufferedPageRange();
    const totalPages = buffered.count;
    if (process.env.TASKORA_DEBUG_PDF === "true") {
      // Helps debugging pagination issues without polluting normal output.
      // eslint-disable-next-line no-console
      console.log("tasks-by-client pdf pages", { start: buffered.start, totalPages });
    }
    for (let i = 0; i < totalPages; i += 1) {
      doc.switchToPage(i);
      drawHeader();
      drawFooter(i, totalPages);
    }

    doc.end();
  });
}
