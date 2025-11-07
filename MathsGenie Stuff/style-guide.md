# Educational Practice App Family - Style Guide

## Overview
This style guide defines the visual language and interaction patterns for a family of educational practice applications. All apps share a consistent visual identity while optimizing user interactions for each specific learning task.

### Core Philosophy
**"Consistent visual identity, flexible interaction design"**

Ben's Maths apps maintain brand recognition through:
- Uniform color palette, typography, and spacing
- Consistent layout structure and component styling
- Recognizable brand presence and quality feel

While allowing UX optimization through:
- Task-appropriate input methods (text, multiple choice, drag & drop, etc.)
- Common-sense interaction patterns that reduce cognitive load
- Intuitive interfaces tailored to each question type

**Example**: A math simplification question uses text input, while an ordering question uses drag and drop. Both look like Ben's Maths, but each uses the interaction method that best serves its purpose.

### Quick Input Selection Guide

**Golden Rule: What's the FASTEST way for the user to respond?**

| Task Type | Best Input Method | Why | Example |
|-----------|------------------|-----|---------|
| 2-6 distinct options | Multiple choice buttons | **Fastest: Just click** | "What is the capital of France?" |
| Ordering/sequencing | Drag & drop | **Faster than typing order** | "Order events chronologically" |
| True/False | Two large buttons | **One click** | "Is 7 prime?" |
| Select from set | Click selection | **Click multiple items** | "Select all the verbs" |
| Value within range | Slider | **Visual + quick** | "Where is 0.6 on the number line?" |
| Pairing items | Matching interface | **Click to connect** | "Match words to definitions" |
| Constructed answer | Text input | **Must be typed** | "Simplify: 2x + 3x = ?" |
| Open-ended answer | Text input | **Cannot use clicks** | "Spell: [pronunciation]" |

**When in doubt: Can the answer be selected rather than typed? → Use click/selection interface**

---

## Brand Identity

### Brand Name
**Ben's Maths** - The brand name must be visible at all times across all apps in the family.

### Brand Personality
- **Friendly & Approachable**: Warm colors, rounded corners, gentle gradients
- **Focused & Calm**: Clean layouts, generous whitespace, minimal distractions
- **Encouraging**: Positive feedback, progress visualization, achievement tracking
- **Professional**: Polished finish, consistent spacing, attention to detail

---

## Color Palette

### Primary Colors
- **Indigo 900**: `#312e81` - Primary headings, dark text
- **Indigo 600**: `#4f46e5` - Primary buttons, CTAs
- **Indigo 500**: `#6366f1` - Gradient start, accents
- **Indigo 200**: `#c7d2fe` - Slider tracks, light accents
- **Indigo 100**: `#e0e7ff` - Hover states
- **Indigo 50**: `#eef2ff` - Background panels, score displays

### Secondary/Accent Colors
- **Purple 600**: `#9333ea` - Gradient end, visual interest
- **Blue 50**: `#eff6ff` - Page background start
- **Indigo 100**: `#e0e7ff` - Page background end

### Feedback Colors
- **Green 100**: `#dcfce7` - Success background
- **Green 800**: `#166534` - Success text
- **Red 100**: `#fee2e2` - Error background
- **Red 800**: `#991b1b` - Error text
- **Red 500**: `#ef4444` - Warning/urgent states (timer)

### Neutral Colors
- **White**: `#ffffff` - Card backgrounds
- **Gray 50**: `#f9fafb` - Settings panel background
- **Gray 100**: `#f3f4f6` - Disabled states
- **Gray 200**: `#e5e7eb` - Secondary buttons
- **Gray 300**: `#d1d5db` - Borders, disabled buttons
- **Gray 500**: `#6b7280` - Helper text
- **Gray 600**: `#4b5563` - Secondary text, icons
- **Gray 700**: `#374151` - Body text

---

## Typography

### Font Family
Use system fonts for optimal performance and native feel:
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
```

### Type Scale
- **Brand Name**: 16px (1rem), semibold, indigo-600
- **Main Title**: 36px (2.25rem), bold, indigo-900
- **Section Headers**: 20px (1.25rem), semibold, gray-700
- **Question Display**: 30px (1.875rem), bold, white
- **Button Text**: 18px (1.125rem), bold
- **Body Text**: 16px (1rem), medium, gray-700
- **Input Text**: 18px (1.125rem), regular
- **Helper Text**: 14px (0.875rem), regular, gray-500
- **Small Labels**: 12px (0.75rem), regular, gray-500

### Font Weights
- **Bold**: 700 - Titles, questions, buttons
- **Semibold**: 600 - Section headers
- **Medium**: 500 - Stats, labels, body emphasis
- **Regular**: 400 - Body text, inputs, helpers

---

## Question Generation & Answer Validation Rules

### Critical Guidelines for Reliable Operation

**These rules prevent common issues with question generation and answer checking:**

### Question Generation Best Practices

#### 1. Always Test Generated Questions
```javascript
// BAD: Generate and display without validation
const question = generateQuestion();
setCurrentQuestion(question);

// GOOD: Validate before displaying
const question = generateQuestion();
if (isValidQuestion(question)) {
  setCurrentQuestion(question);
} else {
  // Regenerate or handle error
  setCurrentQuestion(generateQuestion());
}
```

#### 2. Store Expected Answer with Question
```javascript
// GOOD: Question object includes answer
const question = {
  question: "5(y + 3) + 2(y + 7)",
  answer: "7y + 29",
  workingSteps: [...], // optional for review
  variable: "y"
};
```

#### 3. Avoid Impossible Questions
- Ensure all generated values are within valid ranges
- Check for division by zero
- Verify that there IS a correct answer
- Test edge cases in your generation logic

#### 4. Deterministic Generation
```javascript
// BAD: Random without constraints
const coef = Math.random() * 100; // Could be 47.283745...

// GOOD: Constrained to valid values
const coef = randomInt(1, 10); // Always a clean integer 1-10
```

### Answer Validation Best Practices

#### 1. Normalize Before Comparison
```javascript
const normalizeAnswer = (str) => {
  return str
    .toLowerCase()              // Case insensitive
    .replace(/\s+/g, '')       // Remove all spaces
    .replace(/\+\-/g, '-')     // Normalize signs
    .replace(/\-\+/g, '-')
    .trim();
};

const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(expectedAnswer);
```

#### 2. Handle Multiple Valid Forms
```javascript
// For math expressions, multiple forms may be correct:
const validAnswers = [
  "7y + 29",
  "29 + 7y",  // Commutative
  "7*y + 29", // Explicit multiplication
];

const isCorrect = validAnswers.some(valid => 
  normalizeAnswer(userAnswer) === normalizeAnswer(valid)
);
```

#### 3. Account for Leading Coefficients
```javascript
// "x" and "1x" should both be correct
const normalizeCoefficient = (str) => {
  return str
    .replace(/^1([a-z])/gi, '$1')  // 1x -> x
    .replace(/\+1([a-z])/gi, '+$1') // +1x -> +x
    .replace(/-1([a-z])/gi, '-$1'); // -1x -> -x
};
```

#### 4. Use Tolerance for Numeric Answers
```javascript
// For decimal/estimation questions
const isWithinTolerance = (userVal, expected, tolerance = 0.01) => {
  return Math.abs(userVal - expected) <= tolerance;
};
```

#### 5. Log Failures for Debugging
```javascript
const checkAnswer = () => {
  const correct = normalizeAnswer(userAnswer) === normalizeAnswer(expectedAnswer);
  
  if (!correct) {
    console.log('Answer check failed:');
    console.log('User:', userAnswer, '→', normalizeAnswer(userAnswer));
    console.log('Expected:', expectedAnswer, '→', normalizeAnswer(expectedAnswer));
  }
  
  return correct;
};
```

### Avoiding Ambiguous Questions

**CRITICAL**: Questions must have ONE clear, unambiguous answer. Ambiguous questions frustrate users and undermine learning.

#### Common Sources of Ambiguity

**1. Repeated Elements**
```
❌ BAD: "What is the value of the 7 in 2767?"
   Problem: Which 7? There are two!
   
✅ GOOD: "What is the value of the digit in the tens place in 2767?"
✅ GOOD: "What is the value of the underlined digit: 27̲67?"
✅ GOOD: "In 2767, the 7 in the tens place has a value of ___?"
```

**2. Multiple Correct Interpretations**
```
❌ BAD: "Order these numbers" with [3, 1, 2]
   Problem: Ascending or descending?
   
✅ GOOD: "Order these numbers from smallest to largest"
✅ GOOD: "Arrange in ascending order"
```

**3. Unclear Referents**
```
❌ BAD: "What is the value?" (what value?)
❌ BAD: "Simplify it" (simplify what?)
   
✅ GOOD: "What is the place value of the underlined digit?"
✅ GOOD: "Simplify the expression: 2x + 3x"
```

**4. Ambiguous Operations**
```
❌ BAD: "3 + 4 × 2" without context
   Problem: Without PEMDAS context, could be read left-to-right
   
✅ GOOD: "Using order of operations, calculate: 3 + 4 × 2"
```

#### Prevention Strategies

**For Place Value Questions:**
```javascript
// Generate questions that avoid repeated digits
const generatePlaceValueQuestion = () => {
  let number;
  let targetPosition;
  
  do {
    number = randomInt(1000, 9999);
    targetPosition = randomInt(0, 3); // 0=ones, 1=tens, 2=hundreds, 3=thousands
  } while (hasRepeatedDigit(number, targetPosition));
  
  return {
    question: `What is the value of the underlined digit: ${formatWithUnderline(number, targetPosition)}?`,
    answer: getPlaceValue(number, targetPosition)
  };
};

const hasRepeatedDigit = (number, position) => {
  const digits = String(number).split('');
  const targetDigit = digits[digits.length - 1 - position];
  return digits.filter(d => d === targetDigit).length > 1;
};
```

**For Ordering Questions:**
```javascript
// Always specify direction
const generateOrderingQuestion = (difficulty) => {
  const numbers = generateUniqueNumbers(difficulty);
  const direction = Math.random() < 0.5 ? 'ascending' : 'descending';
  
  return {
    question: `Order these numbers in ${direction} order`,
    items: shuffle(numbers),
    answer: direction === 'ascending' 
      ? numbers.sort((a, b) => a - b)
      : numbers.sort((a, b) => b - a)
  };
};
```

**For Expression Questions:**
```javascript
// Ensure variables don't repeat unless intentional
const generateExpression = () => {
  // Generate coefficients that won't create ambiguous like terms
  const terms = [
    { coef: randomInt(2, 9), variable: 'x' },
    { coef: randomInt(2, 9), variable: 'y' },
    { constant: randomInt(1, 10) }
  ];
  
  return formatExpression(terms);
};
```

#### Visual Disambiguation Techniques

**Use formatting to clarify:**
- **Underlining**: "What is the value of the underlined digit: 27̲67?"
- **Bold**: "What is the value of the **tens** digit in 2767?"
- **Color** (if accessible): Highlight the specific element
- **Position words**: "leftmost", "rightmost", "first", "second", "tens place", "hundreds place"
- **Arrows or markers**: Use visual indicators in the question display

#### Question Review Checklist

Before approving a question type, ask:
- [ ] If I showed this to 5 people, would they all give the same answer?
- [ ] Are there any repeated elements that could cause confusion?
- [ ] Have I specified the direction/format/method clearly?
- [ ] Is there any part of the question that requires assumption?
- [ ] Could this be interpreted two different ways?

#### Recommended Question Formats

**Place Value (Clear):**
- "What is the value of the digit in the [position] place in [number]?"
- "In the number [number], what is the place value of the [position] digit?"
- "What is the value of the underlined digit: [number with underline]?"

**Ordering (Clear):**
- "Order from smallest to largest"
- "Arrange in ascending/descending order"
- "Put these in order starting with the [smallest/largest]"

**Comparison (Clear):**
- "Which is larger: A or B?"
- "Circle the greater value"
- "Select the smallest number"

### Testing Checklist

Before deploying any new question type:

- [ ] Generate 20+ questions and verify all have valid answers
- [ ] **Check for ambiguity: Review each question for multiple interpretations**
- [ ] **Verify no repeated elements cause confusion**
- [ ] Test edge cases (zeros, negatives, large numbers)
- [ ] Try correct answer in multiple formats (verify normalization works)
- [ ] Try common wrong answers (verify they fail correctly)
- [ ] Test with empty input
- [ ] Test with special characters
- [ ] Verify answer validation is commutative where applicable
- [ ] Check that difficulty scaling works as expected
- [ ] Test timer integration (if applicable)
- [ ] **Have someone else read 5 sample questions and confirm they're clear**

### Common Pitfalls to Avoid

❌ **Don't** generate questions with repeated elements that could be ambiguous (e.g., "the 7 in 2767")
❌ **Don't** generate fractional coefficients when integers are expected
❌ **Don't** compare answers without normalization
❌ **Don't** forget to handle commutative operations (a+b = b+a)
❌ **Don't** accept only one format when multiple are valid
❌ **Don't** generate questions without storing the expected answer
❌ **Don't** use floating point for exact matching without tolerance
❌ **Don't** forget to test with actual user input patterns
❌ **Don't** assume users will interpret ambiguous wording the same way you do

✅ **Do** ensure questions have ONE clear, unambiguous interpretation
✅ **Do** use position words or visual markers to clarify what's being asked
✅ **Do** normalize both user input and expected answers
✅ **Do** generate clean, valid questions every time
✅ **Do** store metadata with questions for debugging
✅ **Do** handle multiple valid answer formats
✅ **Do** use appropriate tolerance for numeric answers
✅ **Do** log mismatches during development
✅ **Do** test thoroughly before deployment
✅ **Do** have others review sample questions for clarity

---

## Header & Branding

### Brand Name Display
The brand name **"Ben's Maths"** must appear at the top of every app.

#### Specifications
```
Text: "Ben's Maths"
Font Size: 16px (1rem)
Font Weight: Semibold (600)
Color: indigo-600
Position: Top-left or centered above main title
Margin Bottom: 8px (0.5rem)
Letter Spacing: Slightly wide (tracking-wide)
```

#### Layout Option A: Above Title (Recommended)
```
<div className="text-center mb-2">
  <p className="text-indigo-600 font-semibold tracking-wide">Ben's Maths</p>
</div>
<h1 className="text-4xl font-bold text-indigo-900 text-center">Math Practice</h1>
```

#### Layout Option B: Top-Left Corner
```
<div className="flex items-center justify-between mb-6">
  <p className="text-indigo-600 font-semibold tracking-wide">Ben's Maths</p>
  <div className="flex-1"></div>
</div>
<h1 className="text-4xl font-bold text-indigo-900 text-center mb-2">Math Practice</h1>
```

### App Title Hierarchy
1. **Brand Name** (smaller, indigo-600, semibold) - "Ben's Maths"
2. **App Title** (large, indigo-900, bold) - "Math Practice", "Spelling Practice", etc.
3. **Subtitle** (gray-600, regular) - Description of current mode/activity

---

## Layout & Spacing

### Container

**Large Screens (lg: ≥1024px)**:
- **Max Width**: 1280px (max-w-7xl) to accommodate sidebar + content
- **Padding**: 32px (2rem) on all sides (p-8)
- **Layout**: Flexbox with sidebar (320px) + main content (flex-1)
- **Gap**: 24px between sidebar and content
- **Settings**: White card, rounded-2xl, sticky position

**Mobile/Tablet (< 1024px)**:
- **Max Width**: Full width with padding
- **Padding**: 16px (1rem) on all sides (p-4)
- **Layout**: Stacked (settings above content)
- **Settings**: Compact, minimized height

### Main Content Cards
- **Background**: White with rounded corners
- **Large screens**: rounded-2xl (16px radius)
- **Mobile**: rounded-xl (12px radius)
- **Shadow**: Large shadow for elevation (shadow-2xl)

### Spacing System
Use Tailwind's spacing scale (4px base unit) with responsive modifiers:
- **Extra Tight**: 8px mobile, 8px desktop (2)
- **Tight**: 12px mobile, 16px desktop (3/4)
- **Regular**: 16px mobile, 24px desktop (4/6)
- **Loose**: 24px mobile, 32px desktop (6/8)
- **Extra Loose**: 32px mobile, 48px desktop (8/12)

**Responsive Pattern**:
```jsx
className="mb-4 lg:mb-6" // 16px mobile, 24px desktop
className="p-6 lg:p-8"   // 24px mobile, 32px desktop
```

### Gutters & Margins
- **Component Internal Padding**: 
  - Mobile: 12-24px (p-3 to p-6)
  - Desktop: 24-32px (p-6 to p-8)
- **Settings Panel Padding**:
  - Mobile: 16px (p-4)
  - Desktop: 24px (p-6)
- **Button Padding**: 
  - Mobile: 12px vertical (py-3)
  - Desktop: 16px vertical (py-4)
- **Input Padding**: 12px vertical, 16px horizontal (consistent)

---

## Component Styles

### Buttons

#### Primary Button (Call-to-Action)
```
Background: indigo-600
Hover: indigo-700
Text: white, bold, 18px
Padding: 16px (py-4)
Border Radius: 12px (rounded-xl)
Shadow: Large (shadow-lg)
Width: Full width
Transition: colors
```

#### Secondary Button (Reset/Utility)
```
Background: gray-200
Hover: gray-300
Text: gray-700, medium, 16px
Padding: 8px (py-2)
Border Radius: 8px (rounded-lg)
Width: Full width
Transition: colors
```

#### Disabled State
```
Background: gray-300
Text: gray-400
Cursor: not-allowed
No hover effect
```

### Input Components

**IMPORTANT**: Choose the input type that best serves the question. The style guide provides specifications for multiple input types - use common sense and UX best practices to select the most appropriate one.

#### Text Input Fields
```
Border: 2px solid gray-300
Focus Border: 2px solid indigo-500
Border Radius: 12px (rounded-xl)
Padding: 12px vertical, 16px horizontal
Font Size: 18px
Background: white
Disabled Background: gray-100
Transition: border-color
```

**Best for**: Open-ended answers, spelling, short numerical answers, algebraic expressions

#### Multiple Choice Buttons
```
Background: white
Border: 2px solid gray-300
Hover Border: 2px solid indigo-400
Selected Background: indigo-50
Selected Border: 2px solid indigo-600
Border Radius: 12px (rounded-xl)
Padding: 16px
Font Size: 18px
Text: gray-700 (unselected), indigo-900 (selected)
Display: Grid or flex, full width
Gap: 12px between options
Min Height: 60px
Transition: all colors and borders
```

**Best for**: Questions with 2-6 distinct answer options, true/false, identification tasks

**Layout Pattern**:
```jsx
<div className="grid grid-cols-1 gap-3">
  {options.map((option, index) => (
    <button
      key={index}
      onClick={() => handleSelect(option)}
      className={`p-4 border-2 rounded-xl text-lg transition-all
        ${selected === option 
          ? 'bg-indigo-50 border-indigo-600 text-indigo-900' 
          : 'bg-white border-gray-300 hover:border-indigo-400 text-gray-700'
        }`}
    >
      {option}
    </button>
  ))}
</div>
```

#### Drag and Drop / Sortable Lists
```
Item Background: white
Item Border: 2px solid gray-300
Item Border Radius: 12px (rounded-xl)
Item Padding: 16px
Item Shadow: Small (shadow-sm)
Dragging State: shadow-lg, opacity-80
Drop Zone: dashed border, indigo-300, rounded-xl
Drag Handle: gray-400 icon (grip-vertical)
Gap: 12px between items
Transition: shadow, opacity, transform
```

**Best for**: Ordering items, sequencing, ranking, matching pairs

**Visual States**:
- Idle: white bg, gray-300 border, shadow-sm
- Hover: cursor-grab
- Dragging: shadow-lg, opacity-80, cursor-grabbing
- Drop target: indigo-100 bg, indigo-300 border

**CRITICAL - Rearranging Behavior**:
As the user drags an item, other items must **move to make space** and show where the dragged item will land. This provides clear visual feedback about the final position.

**Animation Specifications**:
- Other items smoothly slide/shift to their new positions as drag occurs
- Transition duration: 200-300ms
- Easing: ease-out or spring animation
- Optional: Subtle shake/wiggle on hover (similar to iOS home screen editing)
  - Shake: ±2px rotation, 300ms duration, ease-in-out
  - Frequency: Gentle continuous animation when in drag mode

**Implementation Pattern**:
```javascript
// Items should animate to new positions
<div className="space-y-3 transition-all">
  {items.map((item, index) => (
    <div
      key={item.id}
      draggable
      onDragStart={(e) => handleDragStart(e, index)}
      onDragOver={(e) => handleDragOver(e, index)}
      onDragEnd={handleDragEnd}
      className={`
        p-4 bg-white border-2 rounded-xl shadow-sm
        transition-all duration-300 ease-out
        ${dragging === index ? 'opacity-80 shadow-lg scale-105' : ''}
        ${dragOver === index ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300'}
        hover:cursor-grab active:cursor-grabbing
      `}
      style={{
        transform: getItemTransform(index), // Calculate position shift
        transition: 'transform 300ms ease-out'
      }}
    >
      {item.content}
    </div>
  ))}
</div>
```

**Recommended Libraries**:
- `@dnd-kit/core` - Modern, accessible drag and drop
- `react-beautiful-dnd` - Popular with smooth animations
- `react-sortable-hoc` - Simple sortable lists

**Key Features to Implement**:
- ✅ Real-time position preview (items move as you drag)
- ✅ Smooth transitions between positions
- ✅ Clear visual indicator of drag state
- ✅ Touch screen support (mobile friendly)
- ✅ Keyboard accessibility (arrow keys to reorder)
- ✅ Snap to position on release
- ✅ Optional shake/wiggle animation for engagement

#### Number Sliders
```
Track: 8px height, gray-200, rounded-lg
Progress: indigo-600 (filled portion)
Thumb: 24px circle, white, shadow-md, border-2 indigo-600
Min/Max Labels: 14px, gray-600
Current Value: 20px, bold, indigo-900, centered above
Padding: 24px vertical for touch targets
```

**Best for**: Selecting values within a range, estimating quantities, adjusting parameters

#### Matching/Connection Interface
```
Item Background: white
Item Border: 2px solid gray-300
Item Border Radius: 12px (rounded-xl)
Item Padding: 12px 16px
Connection Line: 3px wide, indigo-600
Connection Dot: 12px circle, indigo-600
Hover State: border-indigo-400
Selected State: border-indigo-600, shadow-md
Layout: Two columns with connection area between
```

**Best for**: Vocabulary matching, pairing items, connecting concepts

#### Click to Select (Image/Item Selection)
```
Container Border: 2px solid gray-300
Container Border Radius: 12px (rounded-xl)
Hover Border: indigo-400
Selected Border: indigo-600
Selected Overlay: indigo-600 with 20% opacity
Checkmark: white circle with indigo checkmark
Padding: 12px
Transition: border, overlay
```

**Best for**: Identifying correct images, selecting from visual options, categorization

### Sliders
```
Track: 8px height, indigo-200, rounded-lg
Thumb: Default browser styling (styled via appearance-none)
Width: Full width
Cursor: pointer
```

**Labels Above Sliders:**
- Font: 14px, medium, gray-700
- Margin Bottom: 8px
- Include current value in label

**Range Labels Below:**
- Font: 12px, regular, gray-500
- Display: flex, justify-between
- Margin Top: 4px

### Panels & Cards

#### Score Panel
```
Background: indigo-50
Border Radius: 12px (rounded-xl)
Padding: 16px (p-4)
Display: flex, justify-between, items-center
Icons: 20px, indigo-600
Text: gray-700, medium
```

#### Settings Panel
```
Background: gray-50
Border Radius: 12px (rounded-xl)
Padding: 24px (p-6)
Space Between Children: 16px (space-y-4)
```

#### Question Display Card
```
Background: Gradient from indigo-500 to purple-600
Border Radius: 16px (rounded-2xl)
Padding: 32px (p-8)
Shadow: Large (shadow-lg)
Text: white, 30px, bold, centered
Text Break: break-words (for long equations)
```

#### Feedback Cards
```
Border Radius: 12px (rounded-xl)
Padding: 16px (p-4)
Text: centered, medium
Success: green-100 bg, green-800 text
Error: red-100 bg, red-800 text
```

### Icons
- **Size**: 20-24px for most uses
- **Color**: Inherit from parent or gray-600
- **Source**: Lucide React icons (consistent style)
- **Common Icons**: 
  - Timer (clock/time-based features)
  - Award (achievements/scores)
  - Settings (configuration)

---

## Page Background

### Gradient Background
```
Background: Gradient from blue-50 to indigo-100
Direction: Bottom-right diagonal (bg-gradient-to-br)
Min Height: Full viewport (min-h-screen)
Display: flex, items-center, justify-center
Padding: 16px (p-4) for mobile spacing
```

---

## Interaction Patterns

### Answer Submission Flow

1. User provides answer via appropriate input method
2. User presses Enter OR clicks "Check Answer" button
3. Input is disabled immediately
4. Answer is validated
5. Feedback card displays (see feedback behavior below)

### Feedback Behavior (CRITICAL)

**For CORRECT answers:**
- Display success feedback (green card)
- Auto-advance to next question after **2 seconds**
- No user action required
- Smooth transition to keep momentum

**For INCORRECT answers:**
- Display error feedback (red card) with correct answer shown
- **Replace** "Check Answer" button with "Next Question" button
- **Wait** for user to click "Next Question" before advancing
- Allows time to review the correct answer and understand the mistake
- User controls when they're ready to continue

#### Implementation Pattern
```javascript
const checkAnswer = () => {
  const correct = validateAnswer(userAnswer, currentQuestion.answer);
  
  if (correct) {
    setScore(score + 1);
    setFeedback({ type: 'correct', message: 'Correct! Well done!' });
    
    // Auto-advance after 2 seconds
    setTimeout(() => {
      nextQuestion();
    }, 2000);
    
  } else {
    setFeedback({ 
      type: 'incorrect', 
      message: `Not quite. The answer is: ${currentQuestion.answer}` 
    });
    // Do NOT auto-advance - wait for user to click "Next Question"
  }
  
  setQuestionsAnswered(questionsAnswered + 1);
};

const nextQuestion = () => {
  setCurrentQuestion(generateQuestion());
  setUserAnswer('');
  setFeedback(null);
  if (timerDuration > 0) {
    setTimeLeft(timerDuration);
  }
};
```

#### Button Behavior
```javascript
// Show appropriate button based on feedback state
{!feedback && (
  <button onClick={checkAnswer} disabled={!userAnswer.trim()}>
    Check Answer
  </button>
)}

{feedback && feedback.type === 'incorrect' && (
  <button onClick={nextQuestion}>
    Next Question
  </button>
)}

// No button shown for correct answers - auto-advances
```

### Timer Behavior
1. Display timer only when active (duration > 0)
2. Show countdown in seconds
3. Change color to red when ≤ 5 seconds remain
4. Auto-submit when timer reaches 0
5. Treat timeout as incorrect answer (show "Next Question" button)

### Difficulty & Settings
1. Changes take effect on next question
2. No confirmation needed for slider adjustments
3. Reset button clears score and starts fresh
4. Settings always visible (no hide/show)

---

## Adaptive Difficulty (Progressive Overload)

### Core Principle
**REQUIRED**: Every Ben's Maths app must implement adaptive difficulty to maintain user engagement and optimal learning.

Target accuracy: **85-100%**
- Above 85%: User is learning successfully, staying engaged
- Below 85%: User is struggling, may become frustrated
- 100% sustained: Too easy, may become bored

### Progressive Overload Rules

**Increase Difficulty When:**
- User has answered **3 questions correctly in a row** AND
- Current accuracy is **above 85%**
- Action: Increment difficulty by 1 (max 5)

**Decrease Difficulty When:**
- Accuracy falls **below 85%**
- Action: Decrement difficulty by 1 (min 1)

**Check Timing:**
- Evaluate after each question is answered
- Apply changes to the NEXT generated question

### Implementation Pattern

```javascript
const [difficulty, setDifficulty] = useState(2);
const [score, setScore] = useState(0);
const [questionsAnswered, setQuestionsAnswered] = useState(0);
const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);

const checkAnswer = () => {
  const correct = validateAnswer(userAnswer, currentQuestion.answer);
  const newScore = correct ? score + 1 : score;
  const newQuestionsAnswered = questionsAnswered + 1;
  const newConsecutiveCorrect = correct ? consecutiveCorrect + 1 : 0;
  
  // Update state
  setScore(newScore);
  setQuestionsAnswered(newQuestionsAnswered);
  setConsecutiveCorrect(newConsecutiveCorrect);
  
  // Calculate accuracy
  const accuracy = (newScore / newQuestionsAnswered) * 100;
  
  // Adaptive difficulty logic
  if (correct) {
    setFeedback({ type: 'correct', message: 'Correct! Well done!' });
    
    // Increase difficulty: 3 correct in a row + accuracy > 85%
    if (newConsecutiveCorrect >= 3 && accuracy > 85) {
      if (difficulty < 5) {
        setDifficulty(difficulty + 1);
        setConsecutiveCorrect(0); // Reset streak after increasing
        console.log(`Difficulty increased to ${difficulty + 1}`);
      }
    }
    
    setTimeout(() => {
      nextQuestion();
    }, 2000);
    
  } else {
    setFeedback({ 
      type: 'incorrect', 
      message: `Not quite. The answer is: ${currentQuestion.answer}` 
    });
    
    // Decrease difficulty: accuracy < 85%
    if (accuracy < 85 && difficulty > 1) {
      setDifficulty(difficulty - 1);
      console.log(`Difficulty decreased to ${difficulty - 1}`);
    }
  }
};

// Generate question at current difficulty level
const nextQuestion = () => {
  setCurrentQuestion(generateQuestion(difficulty)); // Pass current difficulty
  setUserAnswer('');
  setFeedback(null);
  if (timerDuration > 0) {
    setTimeLeft(timerDuration);
  }
};
```

### Visual Feedback (Optional but Recommended)

Show users when difficulty changes:
```javascript
// Option 1: Toast notification
if (difficultyIncreased) {
  showToast("Great job! Moving to harder questions! 🎯", "success");
}

if (difficultyDecreased) {
  showToast("Let's try some easier ones 💪", "info");
}

// Option 2: Subtle indicator in settings panel
<div className="text-sm text-gray-600 mt-2">
  {difficultyChanged && (
    <span className="text-indigo-600 font-medium">
      {difficultyIncreased ? '📈 Difficulty increased!' : '📉 Difficulty adjusted'}
    </span>
  )}
</div>
```

### Important Notes

**User Control vs Auto-Adjustment:**
- Users can still manually adjust difficulty via slider
- Manual adjustment overrides automatic adjustments
- Automatic adjustments resume after manual change
- Reset button returns to default difficulty (2) and clears adaptive state

**Edge Cases:**
- If user manually sets difficulty to 5, auto-increase is disabled
- If user manually sets difficulty to 1, auto-decrease is disabled
- New session starts at difficulty 2 (middle ground)

**Testing Adaptive Difficulty:**
```javascript
// Test scenarios:
1. Get 3 correct in a row with 90% accuracy → Difficulty should increase
2. Get several wrong, drop to 80% accuracy → Difficulty should decrease
3. Manually adjust slider → Auto-adjustment pauses temporarily
4. Reset quiz → Difficulty returns to 2, streaks reset
```

### Benefits of Progressive Overload

✅ **Maintains engagement**: Users stay in "flow state"
✅ **Personalized learning**: Adapts to individual skill level
✅ **Reduces frustration**: Difficulty drops when struggling
✅ **Prevents boredom**: Increases challenge when mastering content
✅ **Builds confidence**: Users see measurable progress
✅ **Data-driven**: Based on actual performance, not guesswork

---

## Animation & Transitions

### Standard Transitions
```
Duration: 200-300ms
Property: colors, background-color, border-color
Easing: Default ease or ease-out
```

### Drag & Drop Animations
```
Position Changes: 300ms, ease-out
Item Lift (on drag start): 150ms, ease-out
Scale on Drag: 1.05x (subtle)
Opacity on Drag: 0.8
Shadow on Drag: shadow-lg
```

**Rearranging Animation**:
When dragging, other items smoothly transition to their new positions:
```css
.sortable-item {
  transition: transform 300ms ease-out, 
              box-shadow 150ms ease,
              opacity 150ms ease;
}

/* Optional wiggle animation (like iOS) */
@keyframes wiggle {
  0%, 100% { transform: rotate(-1deg); }
  50% { transform: rotate(1deg); }
}

.sortable-item.wiggle {
  animation: wiggle 300ms ease-in-out infinite;
}
```

### Button Transitions
- Hover states: 200ms
- Background color changes: 200ms
- Disabled state transitions: 150ms

### Feedback Cards
- Fade in: 150ms ease-out
- No fade out (replaced by new content)

### Principle: Purposeful Animation
- Keep animations minimal for focus and accessibility
- Use transitions for state changes only
- Avoid distracting motion
- All animations should have clear purpose:
  - Drag & drop: Show spatial relationships
  - Buttons: Confirm interactivity
  - Feedback: Draw attention to results
  - Transitions: Indicate state changes

### Reduced Motion
Respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Accessibility Guidelines

### Universal Principles
- All interactive elements must be keyboard accessible
- Touch targets minimum 44px x 44px
- Focus states clearly visible
- Color is not the only indicator of state

### Color Contrast
- All text must meet WCAG AA standards (4.5:1 for normal text)
- Primary buttons: white on indigo-600 ✓
- Body text: gray-700 on white ✓
- Helper text: gray-500 on white ✓
- Selected states: sufficient contrast between selected/unselected

### Input-Specific Accessibility

#### Text Input
- Associated label always present
- Helper text provides context
- Enter key submits
- Tab navigation works
- Error states clearly indicated

#### Multiple Choice Buttons
- Keyboard navigation with arrow keys or tab
- Enter/Space to select
- Clear visual focus indicators
- Selected state visually distinct from hover
- Disabled options clearly indicated

#### Drag & Drop
- Keyboard alternative (arrow keys to reorder)
- Clear visual feedback during drag
- Announce position changes to screen readers
- Touch-friendly drag handles (minimum 44px)
- Drop zones clearly indicated

#### Sliders
- Keyboard control (arrow keys for adjustment)
- Current value displayed and announced
- Sufficient touch target for thumb (minimum 44px)
- Visual indicator of current position
- Min/max values clearly labeled

#### Matching Interface
- Keyboard navigation between items
- Enter/Space to select/connect
- Clear indication of matched pairs
- Undo functionality available
- Visual connection lines with sufficient contrast

#### Click Selection
- Keyboard navigation through items
- Space to toggle selection
- Clear visual indication of selection
- Checkmarks or similar clear indicators
- Grouping/categorization clearly communicated

### Screen Reader Support
- Meaningful aria-labels for interactive elements
- State changes announced (selected, correct, incorrect)
- Progress updates communicated
- Timer warnings audible
- Question numbers and context provided

### Reduced Motion
- Respect prefers-reduced-motion
- Essential animations only
- Transitions can be disabled
- Drag operations have non-animated alternatives

### Keyboard Shortcuts Summary
- **Enter**: Submit answer / Select option
- **Space**: Select/toggle (buttons, checkboxes)
- **Arrow Keys**: Navigate options / Adjust sliders / Reorder items
- **Tab**: Move between interface elements
- **Escape**: Cancel drag operation (if applicable)

---

## Content Guidelines

### Tone of Voice
- **Encouraging**: "Well done!", "Correct!"
- **Constructive**: "Not quite. The answer is..."
- **Clear**: "Press Enter to submit"
- **Neutral**: Avoid exclamation overuse in instructions

### Button Text
- **Action-oriented**: "Check Answer", "Reset Quiz"
- **Clear verbs**: Check, Reset, Submit, Start
- **No ambiguity**: Avoid "OK", "Continue" without context

### Labels
- **Descriptive**: "Difficulty Level: 3"
- **Show current state**: Display current value on sliders
- **Context provided**: "Timer: 30s" not just "Timer"

---

## Component Checklist

Every practice app in the family should include:

### Core Layout (Required)
- [ ] Responsive container (max-w-7xl on large screens)
- [ ] Page gradient background (blue-50 to-indigo-100)
- [ ] Brand name "Ben's Maths" (indigo-600, semibold, always visible, centered)
- [ ] **Sidebar layout on large screens (lg: ≥1024px)**
  - [ ] Settings sidebar (w-80, sticky)
  - [ ] Main content area (flex-1)
  - [ ] 24px gap between sidebar and content
- [ ] **Compact layout on mobile (< 1024px)**
  - [ ] Minimized settings (two-column sliders)
  - [ ] Stacked layout
  - [ ] All elements visible without scrolling

### Core Components (Required)
- [ ] App title (3xl mobile, 4xl desktop, bold, indigo-900)
- [ ] Subtitle/description (gray-600, centered, text-sm mobile, text-base desktop)
- [ ] Settings panel with responsive layouts:
  - [ ] Full version (hidden on mobile, lg:block)
  - [ ] Compact version (block on mobile, lg:hidden)
- [ ] Difficulty slider (1-5 scale) - user can adjust manually
- [ ] **Adaptive difficulty system (85-100% accuracy target)**
- [ ] Timer slider (0-60 seconds)
- [ ] Reset button
- [ ] Score panel (indigo-50, responsive padding and text)
- [ ] Timer display (when active, with icon)
- [ ] Question display (gradient card, purple-to-indigo, responsive sizing)
- [ ] Primary action button that changes based on state:
  - "Check Answer" (when no feedback)
  - "Next Question" (when incorrect feedback)
  - Hidden (when correct feedback - auto-advances)
- [ ] Feedback cards (always visible without scrolling):
  - Green for correct (auto-advance after 2s)
  - Red for incorrect with answer shown (manual advance)

### Input Components (Choose Best Fit)
- [ ] Text input (if open-ended or precise answers)
- [ ] Multiple choice buttons (if 2-6 distinct options) **← Prefer over text**
- [ ] Drag & drop interface (if ordering/sequencing) **← Prefer over text**
- [ ] Slider (if range selection/estimation)
- [ ] Matching interface (if pairing items)
- [ ] Click selection (if visual identification)
- [ ] Other (document in app-specific guide)

### Required Metrics
- [ ] Score counter
- [ ] Questions answered counter
- [ ] Accuracy percentage (used for adaptive difficulty)
- [ ] Consecutive correct streak (internal, for difficulty adjustment)
- [ ] Time remaining (when timer active)

### Responsive Requirements
- [ ] All content fits in viewport without scrolling
- [ ] Feedback always visible when displayed
- [ ] Action buttons always visible
- [ ] Touch targets ≥44px on mobile
- [ ] Text readable (≥14px minimum)
- [ ] Responsive spacing (smaller on mobile, larger on desktop)

---

## Technical Implementation

### Recommended Platform: Claude Artifacts

**STRONGLY RECOMMENDED**: Build Ben's Maths apps as Claude artifacts (.jsx files) for optimal development and deployment.

#### Why Claude Artifacts?

✅ **Instant Preview**: See changes immediately as you build
✅ **No Setup Required**: No npm install, no build process, no hosting needed
✅ **Single File**: All code in one place - HTML, JS, CSS combined
✅ **Easy Sharing**: Users can access via Claude.ai links
✅ **Rapid Iteration**: Make changes and test instantly
✅ **Built-in Libraries**: React, Tailwind, Lucide icons all available
✅ **No Deployment Hassles**: Works immediately, no server needed

#### Artifact Specifications

**File Extension**: `.jsx`
**Framework**: React functional components
**Styling**: Tailwind CSS utility classes
**Icons**: Lucide React
**State Management**: React hooks (useState, useEffect)

**Template Structure**:
```javascript
import React, { useState, useEffect } from 'react';
import { Timer, Award } from 'lucide-react';

const AppName = () => {
  // State declarations
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState(2);
  
  // Component logic
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* App content */}
    </div>
  );
};

export default AppName;
```

#### Available in Claude Artifacts

**React Hooks**:
- useState, useEffect, useRef, useCallback, useMemo

**Tailwind CSS**:
- All core utility classes
- Responsive modifiers (sm:, md:, lg:, xl:, 2xl:)
- State modifiers (hover:, focus:, active:, disabled:)

**Lucide React Icons** (examples):
```javascript
import { 
  Timer, Award, Settings, Check, X, 
  ChevronUp, ChevronDown, Play, Pause 
} from 'lucide-react';
```

**Other Available Libraries**:
- recharts (for charts/graphs)
- lodash (utility functions)
- mathjs (math operations)

#### Development Workflow

1. **Prompt Claude**: "Create a [subject] practice app following the Ben's Maths style guide"
2. **Instant Preview**: Claude generates .jsx artifact with immediate preview
3. **Iterate**: Request changes, see updates in real-time
4. **Test**: Try different difficulty levels, test edge cases
5. **Share**: Users access via Claude.ai artifact links

#### Alternative: Traditional Development

If not using Claude artifacts:
- **Framework**: React with Vite or Next.js
- **Styling**: Tailwind CSS
- **Deployment**: Vercel, Netlify, or GitHub Pages

But artifacts are **strongly preferred** for Ben's Maths apps.

---

## Responsive Behavior

### Critical Principle: No Scrolling Required

**Every element needed to complete a question must be visible without scrolling on all screen sizes.**

Users should NEVER need to scroll to:
- See the question
- Enter their answer
- View feedback
- Click "Check Answer" or "Next Question"
- See their score

### Layout Strategies by Screen Size

#### Large Screens (lg: 1024px and up - Laptops, Landscape Tablets)

**Sidebar Layout**:
```
┌─────────────────────────────────────┐
│  Brand Name         Score Panel     │
│                                     │
│ ┌──────┐  ┌──────────────────────┐ │
│ │      │  │  Question Display    │ │
│ │ Set- │  │                      │ │
│ │tings │  │─────────────────────│ │
│ │      │  │  Answer Input        │ │
│ │Panel │  │                      │ │
│ │      │  │─────────────────────│ │
│ │      │  │  Feedback (if shown) │ │
│ │      │  │                      │ │
│ │      │  │─────────────────────│ │
│ │      │  │  Action Button       │ │
│ └──────┘  └──────────────────────┘ │
└─────────────────────────────────────┘
```

**Implementation**:
```javascript
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 lg:p-8">
  <div className="max-w-7xl mx-auto">
    {/* Brand Name - spans full width */}
    <div className="text-center mb-4">
      <p className="text-indigo-600 font-semibold tracking-wide">Ben's Maths</p>
    </div>
    
    <div className="lg:flex lg:gap-6">
      {/* Settings Sidebar - left side on large screens */}
      <div className="lg:w-80 lg:flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 lg:mb-0 lg:sticky lg:top-8">
          {/* Settings content */}
        </div>
      </div>
      
      {/* Main Content - right side on large screens */}
      <div className="flex-1 bg-white rounded-2xl shadow-2xl p-8">
        {/* Score, Question, Answer, Feedback, Buttons */}
      </div>
    </div>
  </div>
</div>
```

**Specifications**:
- Settings sidebar: 320px (w-80) fixed width
- Sidebar position: sticky (stays visible when scrolling if needed)
- Gap between sidebar and main: 24px (gap-6)
- Both panels: White background, rounded-2xl, shadow
- All interactive elements fit in viewport height

#### Medium Screens (md: 768px to 1023px - Tablets)

**Stacked Layout with Compact Settings**:
```
┌─────────────────────────────┐
│  Brand Name    Score Panel  │
│                             │
│ ┌─────────────────────────┐ │
│ │ Settings (Compact)      │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │  Question Display       │ │
│ ├─────────────────────────┤ │
│ │  Answer Input           │ │
│ ├─────────────────────────┤ │
│ │  Feedback               │ │
│ ├─────────────────────────┤ │
│ │  Action Button          │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Settings Panel - Compact Mode**:
- Two-column layout for sliders (difficulty | timer)
- Smaller padding (p-4 instead of p-6)
- Smaller text (text-sm)
- Hide labels, show only values

#### Small Screens (< 768px - Phones)

**Minimized Settings**:
```
┌───────────────────────┐
│ Brand    Score: 6/7   │
│ Diff: 3  Timer: 30s   │ ← Compact, one line
│                       │
│ ┌───────────────────┐ │
│ │   Question        │ │
│ │                   │ │
│ └───────────────────┘ │
│                       │
│ ┌───────────────────┐ │
│ │ Answer Input      │ │
│ └───────────────────┘ │
│                       │
│ ┌───────────────────┐ │
│ │ Feedback          │ │
│ └───────────────────┘ │
│                       │
│ [Check Answer Button] │
└───────────────────────┘
```

**Specifications**:
- Settings: Single row, minimal text
- Sliders: Small height (h-1), inline with labels
- Question card: Smaller padding (p-6 instead of p-8)
- Font sizes: Slightly reduced for mobile
- All elements fit in viewport without scrolling

### Responsive Implementation Pattern

```javascript
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 lg:p-8">
  <div className="max-w-7xl mx-auto">
    {/* Brand - Always centered */}
    <div className="text-center mb-2 lg:mb-4">
      <p className="text-indigo-600 font-semibold tracking-wide text-sm lg:text-base">
        Ben's Maths
      </p>
    </div>
    
    {/* Layout changes at lg breakpoint */}
    <div className="lg:flex lg:gap-6">
      {/* Settings - Sidebar on large, compact on small */}
      <div className="lg:w-80 lg:flex-shrink-0 mb-4 lg:mb-0">
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-lg p-4 lg:p-6 lg:sticky lg:top-8">
          {/* Compact settings on mobile */}
          <div className="block lg:hidden space-y-2">
            {/* Single line settings */}
          </div>
          
          {/* Full settings on large screens */}
          <div className="hidden lg:block space-y-4">
            {/* Full settings panel */}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 bg-white rounded-xl lg:rounded-2xl shadow-2xl p-6 lg:p-8">
        {/* Score Panel */}
        <div className="bg-indigo-50 rounded-lg p-3 lg:p-4 mb-4 lg:mb-6">
          {/* Responsive score display */}
        </div>
        
        {/* Question - Responsive sizing */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl lg:rounded-2xl p-6 lg:p-8 mb-4 lg:mb-6">
          <div className="text-white text-2xl lg:text-3xl font-bold text-center">
            {currentQuestion?.question}
          </div>
        </div>
        
        {/* Answer Input */}
        <div className="mb-4 lg:mb-6">
          <label className="block text-gray-700 font-medium mb-2 text-sm lg:text-base">
            Your Answer:
          </label>
          <input className="w-full px-4 py-3 text-lg lg:text-xl" />
        </div>
        
        {/* Feedback - Always visible when present */}
        {feedback && (
          <div className="mb-4 lg:mb-6 p-4 rounded-xl">
            {feedback.message}
          </div>
        )}
        
        {/* Button - Always visible */}
        <button className="w-full py-3 lg:py-4 text-lg lg:text-xl">
          Check Answer
        </button>
      </div>
    </div>
  </div>
</div>
```

### Breakpoints Reference

```javascript
// Tailwind Breakpoints
sm: '640px'   // Small tablets (portrait)
md: '768px'   // Tablets (portrait)
lg: '1024px'  // Tablets (landscape), laptops → SIDEBAR LAYOUT
xl: '1280px'  // Desktop
2xl: '1536px' // Large desktop
```

### Mobile-First Approach

Design for mobile first, then enhance for larger screens:

```css
/* Mobile (default) - Compact, stacked */
.settings { display: block; }
.sidebar { display: none; }

/* Large screens - Sidebar layout */
@media (min-width: 1024px) {
  .settings { display: none; }
  .sidebar { display: block; }
}
```

### Testing Checklist

Test at these viewport sizes:
- [ ] 375px width (iPhone SE) - No scrolling required
- [ ] 768px width (iPad portrait) - Compact settings visible
- [ ] 1024px width (iPad landscape) - Sidebar appears
- [ ] 1440px width (Laptop) - Optimal sidebar layout

### Key Principles

1. **No Scrolling**: All interactive elements fit in viewport
2. **Progressive Enhancement**: More space = better layout, not more features
3. **Touch Targets**: Minimum 44px tall on mobile
4. **Readable Text**: Never smaller than 14px (text-sm)
5. **Adaptive Sizing**: Use lg: modifiers for padding, fonts, spacing
6. **Feedback Visibility**: Always in view after answering

---

## Technical Implementation

### Recommended Platform: Claude Artifacts

**All Ben's Maths apps should be built as Claude Artifacts** for optimal development, deployment, and iteration speed.

#### Why Claude Artifacts?

✅ **Rapid Prototyping**: Build and test immediately in the browser
✅ **No Build Process**: Instant feedback, no webpack/bundling
✅ **Easy Sharing**: Share a working app with a single link
✅ **Iterative Development**: Quick updates and refinements
✅ **Built-in Libraries**: React, Tailwind, and common libraries pre-loaded
✅ **No Deployment Hassle**: Works immediately, no hosting required
✅ **Perfect for Education**: Students can use apps immediately without downloads

### Technical Stack

**Framework**: React (Functional Components with Hooks)
- Use `useState`, `useEffect`, `useCallback` for state management
- No class components
- Modern JavaScript (ES6+)

**Styling**: Tailwind CSS (Utility Classes)
- No separate CSS files needed
- Use Tailwind's built-in classes only
- Responsive design built-in

**File Structure**: Single File
- All code in one `.jsx` file
- No separate components files
- Self-contained and portable

### Available Libraries in Claude Artifacts

Claude artifacts have access to these libraries (already loaded):

```javascript
// React & Hooks
import React, { useState, useEffect, useCallback, useRef } from 'react';

// Icons
import { Timer, Award, TrendingUp, TrendingDown } from 'lucide-react';

// For advanced features (if needed)
import * as d3 from 'd3';              // Data visualization
import _ from 'lodash';                 // Utilities
import * as math from 'mathjs';        // Math operations
```

**For Drag & Drop**, use browser native APIs or request specific libraries:
```javascript
// Native HTML5 Drag & Drop
onDragStart, onDragOver, onDrop

// Or mention to Claude if you need:
// - @dnd-kit/core
// - react-beautiful-dnd
```

### Single-File Structure Pattern

```javascript
import React, { useState, useEffect } from 'react';
import { Timer, Award } from 'lucide-react';

const MathPracticeApp = () => {
  // State management
  const [difficulty, setDifficulty] = useState(2);
  const [score, setScore] = useState(0);
  // ... more state
  
  // Helper functions
  const generateQuestion = () => {
    // Question generation logic
  };
  
  const checkAnswer = () => {
    // Answer validation and adaptive difficulty
  };
  
  // Effects
  useEffect(() => {
    // Timer logic, initialization, etc.
  }, [/* dependencies */]);
  
  // Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full">
        {/* App content */}
      </div>
    </div>
  );
};

export default MathPracticeApp;
```

### Development Workflow with Claude

**1. Initial Creation:**
```
"Create a [topic] practice app following the Ben's Maths style guide"
```

**2. Iterations:**
```
"Update the app to add [feature]"
"Fix the issue where [problem]"
"Add adaptive difficulty using the style guide pattern"
```

**3. Testing:**
```
"Generate 10 sample questions and verify they're not ambiguous"
"Test the adaptive difficulty logic"
```

**4. Refinement:**
```
"Update the colors to match the style guide exactly"
"Add better visual feedback for [interaction]"
```

### Artifact-Specific Best Practices

#### Keep Everything in One File
```javascript
// ✅ GOOD: All logic in main component
const MathPracticeApp = () => {
  const generateQuestion = () => { /* ... */ };
  const checkAnswer = () => { /* ... */ };
  return (<div>...</div>);
};

// ❌ AVOID: Separate component files
// (Artifacts work best as single files)
```

#### Use Inline Constants
```javascript
// ✅ GOOD: Constants defined in component
const MathPracticeApp = () => {
  const DIFFICULTY_RANGE = { min: 1, max: 5 };
  const ACCURACY_TARGET = 85;
  // ...
};

// Also acceptable at module level
const ACCURACY_TARGET = 85;
const MathPracticeApp = () => { /* ... */ };
```

#### Tailwind Only
```javascript
// ✅ GOOD: Tailwind utilities
<div className="bg-indigo-600 hover:bg-indigo-700 rounded-xl p-4">

// ❌ AVOID: Inline styles (use sparingly)
<div style={{ backgroundColor: '#4f46e5' }}>

// ❌ AVOID: CSS files (not available in artifacts)
```

#### Handle All Edge Cases
```javascript
// Artifacts run in browser - handle errors gracefully
const checkAnswer = () => {
  try {
    if (!userAnswer?.trim()) return;
    // ... validation logic
  } catch (error) {
    console.error('Error checking answer:', error);
    setFeedback({ type: 'incorrect', message: 'Please try again' });
  }
};
```

### State Management Pattern

Use this proven pattern for all Ben's Maths apps:

```javascript
const [difficulty, setDifficulty] = useState(2);
const [timerDuration, setTimerDuration] = useState(0);
const [timeLeft, setTimeLeft] = useState(0);
const [score, setScore] = useState(0);
const [questionsAnswered, setQuestionsAnswered] = useState(0);
const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
const [currentQuestion, setCurrentQuestion] = useState(null);
const [userAnswer, setUserAnswer] = useState('');
const [feedback, setFeedback] = useState(null);

// Generate first question
useEffect(() => {
  setCurrentQuestion(generateQuestion(difficulty));
}, []);

// Timer logic
useEffect(() => {
  if (timerDuration > 0 && timeLeft > 0) {
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  } else if (timerDuration > 0 && timeLeft === 0) {
    handleTimeout();
  }
}, [timeLeft, timerDuration]);
```

### Question Generation Pattern

```javascript
const generateQuestion = (difficulty) => {
  // Difficulty affects complexity
  const maxValue = Math.min(10, 5 + difficulty);
  const useNegatives = difficulty >= 3;
  
  // Generate question data
  const question = {
    display: "...",
    answer: "...",
    metadata: { difficulty, timestamp: Date.now() }
  };
  
  // Validate before returning
  if (!isValidQuestion(question)) {
    return generateQuestion(difficulty); // Regenerate
  }
  
  return question;
};
```

### Answer Validation Pattern

```javascript
const normalizeAnswer = (str) => {
  return str
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\+\-/g, '-')
    .replace(/\-\+/g, '-')
    .trim();
};

const checkAnswer = () => {
  if (!userAnswer?.trim()) return;
  
  const correct = normalizeAnswer(userAnswer) === 
                  normalizeAnswer(currentQuestion.answer);
  
  // Update state and apply adaptive difficulty
  // (See Adaptive Difficulty section)
};
```

### File Naming Convention

When creating artifacts, use descriptive names:

```
math-practice.jsx          ✅ Good: Clear, specific
times-tables-practice.jsx  ✅ Good: Describes content
spelling-quiz.jsx          ✅ Good: Clear purpose

practice-app.jsx           ❌ Too generic
app.jsx                    ❌ Too vague
math.jsx                   ❌ Not specific enough
```

### Requesting Updates from Claude

**Be Specific:**
```
✅ "Add a multiple choice interface with 4 buttons styled per the style guide"
✅ "Implement the adaptive difficulty system from the style guide"
✅ "Update the question generation to avoid ambiguous place value questions"

❌ "Make it better"
❌ "Add more features"
```

**Reference the Style Guide:**
```
"Following the Ben's Maths style guide, add [feature]"
"Update the colors to match the style guide exactly"
"Implement progressive overload as specified in the guide"
```

### Testing in Artifacts

Claude artifacts auto-reload, making testing easy:

1. **Test question generation**: Answer 10-20 questions, verify clarity
2. **Test adaptive difficulty**: Get several correct/incorrect, watch difficulty change
3. **Test edge cases**: Try empty inputs, special characters, very long answers
4. **Test timer**: Set short duration, verify timeout behavior
5. **Test reset**: Ensure all state clears properly

### Performance Considerations

Artifacts run entirely in browser:

```javascript
// ✅ GOOD: Efficient operations
const filtered = items.filter(item => item.value > 5);

// ✅ GOOD: Debounced operations for heavy work
const debouncedValidate = useCallback(
  _.debounce((value) => validate(value), 300),
  []
);

// ⚠️ CAUTION: Heavy computations
// Keep generation/validation lightweight
// Most operations should be < 16ms
```

### Debugging Tips

Use console.log liberally during development:

```javascript
console.log('Generated question:', question);
console.log('Normalized answer:', normalizeAnswer(answer));
console.log('Difficulty adjusted:', { 
  from: oldDifficulty, 
  to: newDifficulty, 
  accuracy 
});
```

Claude can see these and help debug issues.

### Deployment & Sharing

**Artifacts are instantly shareable:**
1. Claude generates the artifact
2. User can interact immediately
3. Share via Claude conversation link
4. No hosting, building, or deployment needed

**For Production Use:**
- Copy artifact code to your own environment if needed
- Works as-is in most React environments
- Tailwind CDN included in artifacts
- Consider adding error boundaries for production

### Example Request to Claude

```
Create a times tables practice app following the Ben's Maths style guide v2.3:

- Multiple choice with 4 answer options (clicking is faster than typing)
- Questions like "7 × 8 = ?" with one correct and 3 plausible wrong answers
- Implement adaptive difficulty (85-100% accuracy target)
- Include all required components: brand name, settings, score panel
- Use the correct feedback behavior (auto-advance on correct, manual on incorrect)
- Style exactly per the guide: indigo/purple gradient, white cards, etc.
```

### Key Patterns

Use these patterns consistently across all apps:

```javascript
// State structure
const [/* core state */] = useState(/* initial */);

// Question generation
const generateQuestion = (difficulty) => { /* ... */ };

// Answer checking with adaptive difficulty
const checkAnswer = () => { /* validation + adaptation */ };

// Reset functionality
const resetQuiz = () => { /* clear all state */ };

// Timer management
useEffect(() => { /* timer countdown */ }, [timeLeft]);

// Keyboard shortcuts
const handleKeyPress = (e) => {
  if (e.key === 'Enter' && !feedback) checkAnswer();
};
```

---

## Topic-Specific Customization

### UX Optimization Principle
**Use the input type that best serves the question.** The visual identity remains consistent, but interaction patterns should be optimized for the specific task. Always prioritize user experience and intuitiveness.

### What Can Vary by Subject

#### Question Content & Format
- Question generation algorithms (unique to each subject)
- Display content: equations, words, images, diagrams, audio
- Visual presentation: text-heavy, image-based, mixed media
- Question complexity and structure

#### Input & Interaction Methods
Choose based on what's most intuitive for the question type:

**Text Input** → Open-ended answers, spelling, calculations, short answers
- Math: "Simplify: 2x + 3x" → Text input
- Spelling: "Spell: [pronunciation]" → Text input

**Multiple Choice** → Limited distinct options, identification, classification
- Geography: "Capital of France?" → 4 buttons with city names
- Grammar: "Which sentence is correct?" → 3-4 sentence options
- Science: "Which is a mammal?" → Image-based choice buttons

**Drag & Drop/Sorting** → Ordering, sequencing, ranking, categorization
- History: "Order these events chronologically" → Draggable timeline items
- Math: "Order from smallest to largest" → Draggable number cards
- Language: "Arrange words to form a sentence" → Draggable word tiles

**Sliders** → Range selection, estimation, continuous values
- Math: "Estimate the value" → Number slider
- Science: "What temperature does water boil?" → Temperature slider

**Matching** → Pairing related items, associations
- Vocabulary: "Match words to definitions" → Connection interface
- Math: "Match fractions to decimals" → Two-column matching
- Geography: "Match countries to capitals" → Paired selection

**Click Selection** → Visual identification, categorization
- Grammar: "Select all the nouns" → Click-to-select words
- Math: "Select the even numbers" → Clickable number grid
- Science: "Identify the vertebrates" → Clickable animal images

#### Validation & Feedback
- Answer comparison methods (case-sensitive, normalized, fuzzy matching)
- Partial credit logic (if applicable)
- Feedback specificity (show correct answer, show explanation, show hints)

### What Must Stay Consistent

#### Visual Identity
- Brand name "Ben's Maths" placement and styling
- Color palette and color usage patterns
- Typography hierarchy and font choices
- Container and card styling
- Button styling (when buttons are used)
- Gradient backgrounds and shadows
- Spacing and layout rhythm

#### Core Components
- Settings panel appearance and position
- Difficulty slider (though what it controls varies)
- Timer slider and countdown display
- Score panel layout and metrics
- Feedback card styling (success/error colors)
- Main container structure and sizing
- Page background gradient

#### Interaction Patterns
- Consistent feedback timing (2 second display)
- Auto-advance after feedback
- Enter key submission (where applicable)
- Disabled states during feedback
- Timer countdown behavior
- Reset functionality

### Decision Framework

When designing a new question type, ask:

1. **What would be the FASTEST way for the user to respond?**
   - Clicking is almost always faster than typing
   - If there are multiple defined answers (ordering, multiple choice, selection) → Use click interactions
   - If answer must be constructed or is open-ended → Use text input
   - Speed matters: Users should spend time thinking, not typing

2. **Does this reduce cognitive load?**
   - Can users see all options at once?
   - Is the interaction obvious without instructions?
   - Does it feel intuitive on first use?

3. **Is it accessible?**
   - Keyboard navigable?
   - Touch-friendly targets?
   - Clear visual feedback?

4. **Does it maintain brand consistency?**
   - Same colors, spacing, typography?
   - Fits within established layout?
   - Feels like part of the family?

**Priority Principle: Favor clicking over typing whenever possible.** 
- Typing requires spelling, formatting, case sensitivity considerations
- Clicking is immediate, unambiguous, and faster
- Use text input only when the answer cannot be provided via selection

**Examples of Better Choices:**
- ❌ Type "ascending" or "descending" → ✅ Click "Smallest to Largest" button
- ❌ Type the answer from 4 options → ✅ Click the correct option
- ❌ Type numbers in order → ✅ Click and drag to reorder
- ❌ Type "true" or "false" → ✅ Click True/False buttons
- ✅ Type "7y + 29" → Text is appropriate (answer must be constructed)

---

## Practical Examples: Input Selection

Here are examples showing how different question types use different inputs while maintaining visual consistency:

### Example 1: Algebraic Expansion (Text Input)
```
Question: 5(y + 3) + 2(y + 7)
Input: Text field
Why: Open-ended mathematical expression
User enters: "7y + 29"
```

### Example 2: Fraction Comparison (Multiple Choice)
```
Question: Which is larger: 3/4 or 5/8?
Input: Two choice buttons
Why: Binary choice, clear options
Options: [3/4] [5/8]
```

### Example 3: Order of Operations (Drag & Drop)
```
Question: Arrange these steps in the correct order
Input: Draggable cards with live rearranging
Why: Sequencing task, visual manipulation
Items: [Parentheses] [Exponents] [Multiply/Divide] [Add/Subtract]
Behavior: As user drags, other cards smoothly move to show where item will land
Animation: 300ms ease-out transitions, optional subtle wiggle
```

### Example 4: Number Line Estimation (Slider)
```
Question: Where is 0.6 on the number line?
Input: Slider from 0 to 1
Why: Continuous value selection, visual representation
Tolerance: ±0.05 for correct answer
```

### Example 5: Vocabulary Matching (Connection Interface)
```
Question: Match words to their definitions
Input: Two-column matching with connecting lines
Why: Shows relationships, allows multiple attempts
Left: [Benevolent] [Malevolent] [Ambivalent]
Right: [Kindly] [Hostile] [Uncertain]
```

### Example 6: Shape Identification (Click Selection)
```
Question: Select all the quadrilaterals
Input: Grid of clickable shapes with images
Why: Visual identification, multiple selections
Shapes: [Square] [Triangle] [Rectangle] [Pentagon] [Rhombus] [Circle]
```

### Example 7: True/False Questions (Large Toggle Buttons)
```
Question: Is π greater than 3?
Input: Two large buttons (True/False)
Why: Binary choice, large touch targets
Layout: [True] [False] - side by side or stacked
```

### Example 8: Spelling Practice (Text + Audio)
```
Question: [🔊 Play sound]
Input: Text field
Why: Audio-to-text transcription
Special: Play button before text input
User enters: "necessary"
```

### Visual Consistency Across Examples

Despite different input types, all maintain:
- Same indigo-600/purple-600 gradient question card
- Same white container with rounded corners
- Same score panel at top
- Same settings panel above questions
- Same indigo-600 primary action buttons
- Same feedback cards (green/red)
- Same spacing and typography

### Component Flexibility Matrix

| Question Type | Best Input | Keep Consistent |
|--------------|------------|-----------------|
| Open-ended math | Text input | Colors, spacing, container |
| Multiple options (2-6) | Choice buttons | Button styling, feedback |
| Sequencing | Drag & drop | Card styling, spacing |
| Range values | Slider | Track colors, labels |
| Pairing items | Matching lines | Color palette, layout |
| Visual ID | Click selection | Border states, checkmarks |
| True/False | Large buttons | Button styling, spacing |
| Audio-based | Text + play button | Input styling, layout |

---

## Examples of Family Members

### Math Practice (Reference Implementation)
- **Topics**: Algebraic expansion, simplification, fractions, decimals
- **Primary Input**: Text input for expressions
- **Also Uses**: Multiple choice for concept questions, sliders for estimation
- **Difficulty Effect**: Number of brackets, use of negatives, integer size

### Spelling Practice
- **Topics**: Common words, homophones, challenging spellings
- **Primary Input**: Text input with audio playback button
- **Also Uses**: Multiple choice for word usage context
- **Difficulty Effect**: Word length, syllable complexity, uncommon words

### Times Tables Practice
- **Topics**: Multiplication facts, division, squared numbers
- **Primary Input**: Text input for numeric answers
- **Also Uses**: Number grid selection for multiples identification
- **Difficulty Effect**: Table size (2-12), mixed operations, time pressure

### Fraction Workshop
- **Topics**: Equivalent fractions, ordering, simplification
- **Primary Input**: Drag and drop for ordering fractions
- **Also Uses**: Text input for simplification, sliders for estimation
- **Difficulty Effect**: Denominator size, mixed numbers, improper fractions

### Vocabulary Builder
- **Topics**: Definitions, synonyms, antonyms, word usage
- **Primary Input**: Multiple choice buttons (4 options)
- **Also Uses**: Matching interface for synonym pairs, text for spelling
- **Difficulty Effect**: Word complexity, number of similar options

### Geography Quiz
- **Topics**: Capitals, countries, landmarks, flags
- **Primary Input**: Multiple choice with 4-6 options
- **Also Uses**: Click-to-select on maps, drag and drop for matching
- **Difficulty Effect**: Region size, similar-sounding names, obscure locations

### Mental Math Speed
- **Topics**: Quick calculations, estimation, number sense
- **Primary Input**: Text input for rapid-fire problems
- **Also Uses**: Multiple choice for "closest answer" estimation
- **Difficulty Effect**: Number size, operation complexity, time pressure

### Grammar Practice
- **Topics**: Punctuation, parts of speech, sentence structure
- **Primary Input**: Multiple choice for correction questions
- **Also Uses**: Click-to-select words (identify nouns, etc.), drag and drop for sentence ordering
- **Difficulty Effect**: Sentence complexity, number of errors, subtle mistakes

### Shape Sorter
- **Topics**: Geometric shapes, properties, classifications
- **Primary Input**: Click selection on shape grids
- **Also Uses**: Drag and drop to categorize, multiple choice for properties
- **Difficulty Effect**: Shape complexity, 2D vs 3D, property subtlety

---

## Common Patterns Across All Apps

Despite different input types, every app includes:

1. **Ben's Maths** branding at the top (centered, always visible)
2. **Responsive layout**:
   - Large screens (≥1024px): Sidebar settings, main content area
   - Mobile: Compact settings, stacked layout
   - **No scrolling required** to complete questions
3. Gradient background (blue-50 to indigo-100)
4. Settings panel with difficulty and timer sliders
5. **Adaptive difficulty system (85-100% accuracy target)**
6. Score, questions, and accuracy tracking
7. Purple-to-indigo gradient question display
8. Appropriate input method for the question type (prefer clicks over typing)
9. Consistent feedback behavior:
   - ✅ **Correct**: Green feedback, auto-advance after 2 seconds
   - ❌ **Incorrect**: Red feedback with correct answer, "Next Question" button (no auto-advance)
10. Feedback and action buttons always visible without scrolling
11. Reset button in settings
12. Keyboard shortcuts (Enter to submit, etc.)

---

## File Naming Convention

```
subject-practice.jsx
math-practice.jsx
spelling-practice.jsx
vocab-practice.jsx
geography-practice.jsx
```

---

## Version Control

**Style Guide Version**: 2.4  
**Last Updated**: November 2025  
**Maintained By**: Ben's Maths  

### Changelog
- v2.4 - **MAJOR UPDATE**: Added Technical Implementation section strongly recommending Claude artifacts; comprehensive responsive layout system with sidebar for large screens and minimized settings for mobile; no-scrolling principle; complete breakpoint specifications and implementation patterns
- v2.3 - Added required adaptive difficulty system (progressive overload, 85-100% accuracy target); updated input selection to prioritize speed and clicking over typing; emphasized "what's fastest?" decision framework
- v2.2 - Added comprehensive guidance on avoiding ambiguous questions; strategies for place value, ordering, and expression questions; visual disambiguation techniques; enhanced testing checklist
- v2.1 - Added question generation and answer validation best practices; updated feedback behavior (auto-advance for correct, manual for incorrect); enhanced drag & drop specifications with rearranging animations
- v2.0 - Added flexible input types and UX optimization framework; multiple input patterns (text, multiple choice, drag & drop, sliders, matching, click selection); practical examples and decision framework
- v1.0 - Initial style guide based on Math Practice app

---

## Design Tokens (Quick Reference)

```javascript
// Colors
primary: {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  500: '#6366f1',
  600: '#4f46e5',
  900: '#312e81'
}

// Spacing
spacing: {
  'xs': '8px',
  'sm': '16px',
  'md': '24px',
  'lg': '32px',
  'xl': '48px'
}

// Border Radius
radius: {
  'sm': '8px',
  'md': '12px',
  'lg': '16px',
  'xl': '24px'
}

// Font Sizes
fontSize: {
  'xs': '12px',
  'sm': '14px',
  'base': '16px',
  'lg': '18px',
  'xl': '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px'
}
```

---

## Support & Questions

When creating new apps in this family, refer to this guide and the reference implementation (math-practice.jsx). 

### Key Principles

1. **Visual Consistency**: All apps must look like they belong to the Ben's Maths family
2. **UX Flexibility**: Choose input types that optimize the user experience for each question type
3. **Common Sense UX**: If a different input method would make the task easier or more intuitive, use it
4. **Brand Recognition**: Users should immediately recognize any app as part of Ben's Maths through consistent visual identity

### The Golden Rule

**"Keep the visual identity consistent, optimize the interaction for the task."**

If a user switches from Math Practice to Spelling Practice to Geography Quiz, they should:
- ✅ Immediately recognize the Ben's Maths brand and visual style
- ✅ See familiar layout, colors, typography, and components
- ✅ Feel the same level of polish and quality
- ✅ Notice different input methods that make sense for each subject
- ✅ Not be confused by arbitrary interface differences

### Quick Decision Guide

**Use Text Input when:**
- Answers are open-ended
- Spelling or precise wording matters
- Mathematical expressions need to be entered
- Short numerical answers are required

**Use Multiple Choice when:**
- 2-6 distinct answer options exist
- Recognition is easier than recall
- Options are mutually exclusive
- Question tests identification or selection

**Use Drag & Drop when:**
- Order or sequence matters
- Items need to be categorized
- Spatial relationships are important
- Physical manipulation aids learning

**Use Sliders when:**
- Answer is a value within a range
- Estimation is being practiced
- Visual representation helps understanding

**Use Matching when:**
- Pairing relationships are key
- Multiple items need connecting
- Associations are being taught

**Use Click Selection when:**
- Visual identification is required
- Multiple items can be selected
- Recognition from a set is the goal

---

## Design Tokens (Quick Reference)
