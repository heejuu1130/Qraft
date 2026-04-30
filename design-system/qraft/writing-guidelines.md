# Qraft Writing Guidelines

## Role And Identity

Qraft is a tool for designing thought. Its voice is not a helper that explains everything to the user. It is the architect of silence: a system that leaves space, gives structure, and lets the user face what is behind the text.

Qraft copy should not over-serve. It should reveal a frame.

## Core Principles

### Void

Write less. Remove decorative warmth, needless encouragement, and friendly filler.

Avoid:

- chatty greetings
- excessive explanations
- emotional overstatement
- mechanical AI helper language

### Refining

Replace ordinary UI language with physical, architectural, and contemplative language.

Prefer:

- 사유
- 이면
- 궤적
- 직조
- 균열
- 머무름
- 뼈대
- 침묵
- 마주함
- 투영

Avoid:

- 꿀팁
- 대박
- 완료
- 쨘
- 실패
- 클릭하세요
- 입력창

### Structure

Do not command. Present the situation with enough clarity that the user can choose the next action.

Prefer quiet statements over direct instruction.

### Trace

Treat user data as a durable philosophical trace, not disposable digital content.

Use language that suggests accumulation, residue, path, and architecture.

## Tone

Qraft copy is:

- calm
- sparse
- weighty
- contemplative
- philosophical
- dry, but deep
- metaphorical without becoming vague

Qraft copy is not:

- cute
- cheerful
- promotional
- excessively friendly
- tutorial-like
- celebratory
- apologetic by default

## Hard Rules

- Do not use emoji.
- Avoid exclamation marks.
- Do not begin with generic greetings.
- Do not write like a chatbot.
- Do not use phrases like `무엇을 도와드릴까요?`, `성공적으로 완료되었습니다`, `다시 시도해주세요`, `~해볼까요?`.
- Do not explain the interface unless the state is ambiguous.
- Prefer one sentence. Use two only when the state needs a turn.

## UI Copy Transformations

| Situation | Generic Copy | Qraft Copy |
| --- | --- | --- |
| Empty state | 아직 작성된 메모가 없네요. 첫 메모를 남겨보세요! | 고요한 공백입니다. 첫 번째 사유의 궤적을 남겨주세요. |
| Loading | 잠시만 기다려주세요. AI가 질문을 만들고 있습니다. | 텍스트의 이면을 들여다보는 중입니다. |
| Inversion question | 생각을 바꿔볼까요? 이런 질문은 어때요? | 당연함을 깨뜨리는 하나의 균열입니다. |
| Error | 오류가 발생했습니다. 다시 시도해주세요. | 사유의 흐름이 잠시 끊겼습니다. 다시 한번 텍스트를 직조합니다. |
| Share | 링크를 복사해서 친구들에게 내 생각을 공유해보세요! | 사유의 공간으로 누군가를 초대합니다. |

## Component Copy Patterns

### Input Labels

Use nouns that describe the material, not the action.

Prefer:

- 텍스트
- 링크
- 주제
- 사유의 단서
- 마주할 문장

Avoid:

- 입력
- 입력창
- 작성하기
- 붙여넣기

### Placeholder Copy

Placeholders should feel like an invitation into a surface, not an instruction.

Examples:

- 들여다볼 링크나 주제를 남깁니다
- 하나의 문장, 하나의 균열
- 사유가 머무를 단서를 남깁니다

### Buttons

Buttons should be short and structural.

Prefer:

- 직조
- 마주하기
- 들여다보기
- 남기기
- 초대

Avoid:

- 시작하기
- 클릭
- 제출
- 완료
- 생성하기

### Loading

Loading copy should describe an invisible process.

Examples:

- 텍스트의 이면을 들여다보는 중입니다.
- 질문의 뼈대를 세우는 중입니다.
- 흩어진 문장을 하나의 구조로 직조합니다.

Loading may unfold in staged copy when the interface is visualizing a longer reasoning process.

Examples:

- 텍스트의 뼈대를 추리고 있습니다.
- 이면에 숨겨진 질문을 직조하는 중입니다.
- 이제, 당신의 사유를 마주할 시간입니다.

When an external model responds quickly, preserve a minimum refining sequence. Each staged loading sentence should remain visible long enough to be read and felt. Current Qraft baseline: at least 2.8 seconds per stage.

### Empty States

Empty states should make absence feel intentional.

Examples:

- 고요한 공백입니다.
- 아직 남겨진 궤적이 없습니다.
- 사유가 머무를 자리가 비어 있습니다.

### Error States

Errors should acknowledge interruption without dramatizing it.

Examples:

- 사유의 흐름이 잠시 끊겼습니다.
- 텍스트의 구조가 닿지 않았습니다.
- 다시 한번 문장을 마주합니다.

## Voice Checklist

Before shipping copy, check:

- Can this be shorter?
- Is it explaining too much?
- Does it sound like an app, or like Qraft?
- Does it create space for thought?
- Did it avoid generic AI assistant language?
- Is the metaphor grounded enough to be understood?
