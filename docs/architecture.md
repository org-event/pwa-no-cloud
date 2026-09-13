# Архитектура и системный дизайн NoCloud

Для новых разработчиков: сначала [glossary.md](./glossary.md), затем этот файл, потом [requirements.md](./requirements.md).  
Интерактивная схема рядом с чатом Cursor: [NoCloud System Design](/Users/org-event/.cursor/projects/Users-org-event-git-step-pwa-no-cloud/canvases/NoCloud-System-Design.canvas.tsx) (для IDE). В git для всех — этот файл с Mermaid.

---

## 1. Одна картина

```mermaid
flowchart TB
  subgraph clients["Клиенты"]
    PWA["PWA / Vue UI\nTelegram-like shell"]
    WV["WebView shell later\nтот же фронт"]
  end

  subgraph domains["Домены клиента (TS)"]
    ID[identity]
    PR[profile / contacts]
    PRES[presence]
    CALL[call]
    TR[transfer]
    SES[session]
    DISC[discovery]
    CFG[config]
  end

  subgraph control["Control plane"]
    REL1[Реле Node A]
    REL2[Реле Node B]
    REL3[Реле Node C]
    SIG["Signaling adapters\nWS · poll · manual QR\n· WebTransport?"]
  end

  subgraph media["Media plane"]
    P2P["WebRTC P2P\nодин PC: media + DataChannel"]
    TURN[TURN свой / из пучка]
    SFU["SFU later\nгруппы 7–20+"]
  end

  PWA --> ID & PR & PRES & CALL & TR & CFG
  WV --> PWA
  CALL --> SES
  TR --> SES
  PRES --> SIG
  SES --> SIG
  DISC --> SIG
  SIG --> REL1 & REL2 & REL3
  SES --> P2P
  P2P -.->|если ICE fail| TURN
  CALL -.->|N растёт| SFU
```

**Правило:** стрелки control и media разделены. Блокировка реле ≠ обязательно обрыв уже установленного P2P.

---

## 2. Что есть что (клиент ≠ сервер)

| кусок | роль | стек MVP |
|---|---|---|
| **PWA клиент** | UI + домены + WebRTC | Vue + TypeScript + Vite+ |
| **Реле (Node тонкий)** | presence, signaling, peer-list, challenge | `server/` на Node.js |
| **STUN/TURN** | ICE / запасной медиа-путь | coturn или capability реле |
| **WebView later** | тот же клиент в apk/desktop shell | Capacitor / Tauri WebView |

Реле **не** является «бэкендом мессенджера с аккаунтами». Это сменный почтальон control-plane.

---

## 3. Модули клиента и зависимости

```mermaid
flowchart LR
  UI[ui] --> CALL & TR & PRES & contacts & CFG
  CALL --> SES
  TR --> SES
  PRES --> relayAdapters
  SES --> relayAdapters
  contacts --> profile --> identity
  discovery --> relayAdapters
  CFG --> SES
```

Запрещены циклы. UI не импортирует SDP/crypto напрямую — только фасады доменов.

Целевые папки (эволюция текущего `src/`):

```
src/
  domain/     identity profile contacts call presence transfer session …
  lib/        webrtc ice signaling/* opfs chunk crypto …
  ui/         telegram-like screens
  config/
server/       тонкое реле (Node), контракт стабилен
```

Организация по духу OpenPolySphere: явные границы + ADR, даже если пока не cargo-workspace.

---

## 4. Потоки

### 4.1 Знакомство (QR, без реле)

```mermaid
sequenceDiagram
  participant A as Клиент A
  participant B as Клиент B
  A->>A: offer + ICE
  A-->>B: QR / paste (signed invite)
  B->>B: answer + ICE
  B-->>A: ответ
  A->>B: P2P DataChannel / media
```

### 4.2 Звонок через реле

```mermaid
sequenceDiagram
  participant A as A
  participant R as Реле
  participant B as B
  A->>R: signed challenge
  B->>R: signed challenge
  A->>R: knock / offer
  R->>B: offer
  B->>R: answer
  R->>A: answer
  A->>B: ICE / P2P media
  Note over A,B: Реле дальше не в media plane
```

### 4.3 Рост группы (задел)

```mermaid
stateDiagram-v2
  [*] --> OneToOne: N=2 mesh
  OneToOne --> SmallMesh: N≤~6 mesh legs
  SmallMesh --> SFU: N растёт / политика
  SFU --> SmallMesh: деградация / нет SFU
```

---

## 5. Отказоустойчивость (заложено сразу)

1. Несколько реле (до 3 активных) + пучок в кэше.  
2. Media предпочитает P2P; TURN только явно.  
3. Call = multi-leg с первого дня (MVP использует 1 leg).  
4. Topology strategy: `mesh` | `sfu` (sfu later).  
5. Signaling adapters: manual · WS · (WebTransport/QUIC когда уместно).  
6. Антиабьюз: rate-limit + pubkey сейчас; PoW — слот в интерфейсе.

---

## 6. Безопасность (кратко)

- Identity офлайн; реле не выдаёт «логин».  
- Профили/инвайты подписаны.  
- Ключ локально под master/BIP39; бэкап только шифрованный.  
- Чужой TURN по умолчанию запрещён.  
- Threat model: случайный админ реле / фишинг ника — да; «неубиваемость против DPI» — не обещание M1.

---

## 7. Документы рядом

| файл | зачем |
|---|---|
| [glossary.md](./glossary.md) | термины по-русски |
| [requirements.md](./requirements.md) | FR/NFR и решения A/B |
| [vision.md](./vision.md) | куда идём |
| [roadmap-wide.md](./roadmap-wide.md) | шаги |
| [adr/](./adr/) | почему решили так |
| [plan.md](./plan.md) | фундамент файлов WebRTC |
