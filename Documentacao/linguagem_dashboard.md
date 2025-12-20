# Linguagem do Dashboard

Objetivo: manter todas as telas compreensiveis para quem opera o Taskora no dia a dia (POs, atendimento, operacao). Evite jargoes tecnicos e traduza conceitos de plataforma para beneficios praticos.

## Principios
- **Fale sobre o resultado, nao sobre a tecnologia.** Exemplos: "Dados atualizados" em vez de "Conector sincronizado"; "Integracao ausente" em vez de "Sem directoryId".
- **Explique o proximo passo.** Mensagens de erro devem indicar o que o usuario pode fazer ("Atualize os dados", "Vincule o cliente") e nao apenas expor o status tecnico.
- **Use vocabulario consistente.** Prefira "integracao" para qualquer conector (Google, Meta, GA4), "ficha do cliente" para `/clients/[id]`, "linha do tempo" para `timeline`.
- **Evite siglas internas** (MCP, GAQL, claims). Se forem indispensaveis, mova-as para tooltips ou documentacao.

## Referencias rapidas
| Antes | Depois |
| --- | --- |
| "Conector MCP" | "Integracao" |
| "Sincronizado" | "Dados atualizados" |
| "Pending secret" | "Configuracao pendente" |
| "Range invalido" | "Periodo nao aceito pela plataforma" |
| "Tokens EXTERNAL_*" | "Configuracao pendente no painel tecnico" |

## Onde aplicar
- Componentes principais em `apps/web/components/dashboard` e `apps/web/components/clients`.
- Mensagens de erro retornadas pela API (ex.: `/clients/:id/metrics/summary`).
- Documentacao voltada ao PO (`Documentacao/README_dev.md`, `Instrucoes_Novos_Chats.md`).

Revisoes futuras devem consultar este arquivo e manter o tom direto e orientado a acao. Se surgir um novo termo tecnico, inclua a traducao amigavel nesta tabela antes de usa-lo no front.
