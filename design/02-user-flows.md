# 2. User flows

Diagrams use Mermaid (GitHub and VS Code with a Mermaid preview draw them).

## 2.1 New player: onboarding (about 60 seconds)

```mermaid
flowchart TD
  W0[Website: 'I'm preparing for…' CGL / PO / NTPC] -->|exam pre-selected| C
  A[Open Takkar] --> B{Played before?}
  B -- yes --> H[Home]
  B -- no --> E[1. Which exam? SSC CGL · IBPS PO · RRB NTPC]
  E --> F[2. When is it? month or 'Not decided']
  F --> C[3. Sign in: Google / Phone / Play as guest]
  C --> G[4. Nickname + I am 18 or older]
  G --> P[5. Your exam's rules: marking, time, skip advice]
  P --> Q[First duel vs the rival, in the exam pattern]
  Q --> R[Result in exam marks + topic breakdown]
  R --> S[6. Daily goal 1 / 3 / 5 duels + reminder, optional]
  S --> H
```

- The exam comes **first**, so the app feels like it is about *their* exam from the first tap. Sign-in comes after, with the exam already chosen.
- Coming from the website's exam picker skips step 1.
- Players from 0.2 (no exam yet) see step 1 once on their next open; their games are kept.
- Step 5 fixes today's surprise negative scores.

## 2.2 Daily loop

```mermaid
flowchart LR
  H[Home] --> D[Rival duel]
  H --> FD[Duel a friend]
  H --> SD[Squad duel of the day]
  H --> RM[Live room tonight - countdown]
  D --> R[Result + mistakes with steps]
  R -->|weakest topic| P[Topic practice]
  R -->|rematch| D
  H --> MM[Mini mock 25 Q]
```

## 2.3 Friend duel

```mermaid
flowchart TD
  A[Duel a friend] --> B[Link + 6-letter code, share to WhatsApp]
  B --> L[Lobby: waiting for friend]
  L -->|friend opens link| J[Both in lobby, both tap Ready]
  J --> C[3-2-1, same 10 questions together]
  C --> X[Live: each sees the other's score bar move]
  X --> R[Result: both scores, question by question]
  L -->|no friend in 10 min| CH[Becomes a challenge: play now, friend has 24 h]
  CH --> RC[Friend plays later, both see the result]
```

## 2.4 Squad

```mermaid
flowchart TD
  N[Squad tab] --> M{In a squad?}
  M -- no --> CR[Create a squad: name, exam] --> INV[Invite link]
  M -- no --> JN[Join with link / code]
  M -- yes --> SQ[Squad page: daily squad duel, today's table, weekly mission, members, reactions]
  SQ --> P[Play today's squad duel]
  SQ --> F[Duel a member live]
  SQ --> MG[Owner: remove member, hand over, rename; anyone: leave, report]
```

## 2.5 League and live room: student

```mermaid
flowchart TD
  L[Invite link from the educator] --> S{Signed in?}
  S -- no --> SU[Sign in, exam pre-filled from the league]
  S -- yes --> LP[League page: daily duel, weekly table, upcoming rooms]
  SU --> AP{Approval needed?} --> W[Waiting for approval] --> LP
  LP --> RS[Room tonight 8:00 - I'll be there]
  RS --> LB[Lobby opens 7:45 - JOIN]
  LB --> LV[8:00 doors close - test starts for everyone]
  LV --> SUB[Submit or time ends]
  SUB --> RES[Results when the room ends: rank, percentile, solutions]
  RS -.->|arrives after 8:00| LOCK[Joining closed at the start - next room]
```

## 2.6 Educator

```mermaid
flowchart TD
  A[You → Become an educator] --> F[Form: name, channel or institute link, subjects, exam]
  F --> AD[Takkar admin approves, usually within 24 h]
  AD --> CL[Create league: name, exam, approval on/off]
  CL --> INV[Invite link + QR + WhatsApp message]
  CL --> QB[Question bank: write / upload sheet]
  CL --> CR[Create room: title, questions, start time, duration, who can join]
  CR --> LIVE[During the room: joined, submitted, live count]
  LIVE --> RES[Results: spread, hardest questions, who missed it, export]
```

## 2.7 Edge cases

- **Late for a room:** cannot join after the start; shown the next room. Educator can set a short grace period (0–5 min, default 0).
- **Disconnected in a room:** can rejoin if they joined before the start; the clock keeps running.
- **Friend leaves a live duel:** counts as a loss for them; the other finishes alone and wins if ahead.
- **Two people tap the same duel link:** the first to join plays; the second sees "This duel already has two players".
- **Room ends while someone is mid-question:** that question counts as skipped.
- **Educator removes a wrong question after the room:** everyone re-scored, ranks updated, with a note.
- **Guest tries to join a squad, league, room or friend duel:** must sign in (needs a stable identity). Rival duels and practice stay open to guests.
- **Under 18 opens an invite:** the age rule is shown; joining requires the 18+ confirmation.
