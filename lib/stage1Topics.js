const BASE_URL = "https://www.mathsgenie.co.uk";

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const choiceId = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    return `choice-${counter}`;
  };
})();

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const gcd = (a, b) => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
};

const simplifyFraction = (numerator, denominator) => {
  const divisor = gcd(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
};

const formatFraction = ({ numerator, denominator }) =>
  `${numerator}/${denominator}`;

const formatTime = (minutes) => {
  const hrs = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
};

const normalizeCoordinate = (value) => {
  const sanitized = value.replace(/[()\s]/g, "");
  if (!sanitized.includes(",")) return null;
  const [x, y] = sanitized.split(",").map((part) => Number(part));
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return `(${x}, ${y})`;
};

const numericEvaluate = (correctValue) => (input) => {
  if (input === null || input === undefined) {
    return { correct: false, correctAnswer: correctValue.toString() };
  }
  const sanitized = input.toString().replace(/,/g, "").trim();
  if (!sanitized) {
    return { correct: false, correctAnswer: correctValue.toString() };
  }
  const parsed = Number(sanitized);
  if (Number.isNaN(parsed)) {
    return { correct: false, correctAnswer: correctValue.toString() };
  }
  return {
    correct: parsed === correctValue,
    correctAnswer: correctValue.toString(),
  };
};

const fractionEvaluate = (targetFraction) => (input) => {
  const sanitized = input.replace(/\s/g, "");
  if (!sanitized.includes("/")) {
    return { correct: false, correctAnswer: formatFraction(targetFraction) };
  }
  const [numStr, denStr] = sanitized.split("/");
  const numerator = Number(numStr);
  const denominator = Number(denStr);
  if (Number.isNaN(numerator) || Number.isNaN(denominator) || denominator === 0) {
    return { correct: false, correctAnswer: formatFraction(targetFraction) };
  }
  const simplified = simplifyFraction(numerator, denominator);
  return {
    correct:
      simplified.numerator === targetFraction.numerator &&
      simplified.denominator === targetFraction.denominator,
    correctAnswer: formatFraction(targetFraction),
  };
};

const coordinateEvaluate = (expected) => (input) => {
  const normalized = normalizeCoordinate(input);
  return {
    correct: normalized === expected,
    correctAnswer: expected,
  };
};

const generatePlaceValueQuestion = () => {
  const number = randInt(10_000, 999_999);
  const numberStr = number.toString();
  const positions = [
    "ones",
    "tens",
    "hundreds",
    "thousands",
    "ten thousands",
    "hundred thousands",
  ];
  const positionIdx = randInt(0, numberStr.length - 1);
  const digit = Number(numberStr[numberStr.length - 1 - positionIdx]);
  const placeName = positions[positionIdx] ?? "ones";
  const value = digit * 10 ** positionIdx;

  return {
    type: "input",
    prompt: `What is the value of the digit ${digit} in the ${placeName} place of ${number}?`,
    placeholder: "Type the value",
    evaluate: numericEvaluate(value),
    explanation: `${digit} in the ${placeName} place is worth ${value}.`,
  };
};

const generateTimeQuestion = () => {
  const startHour = randInt(6, 16);
  const startMinute = [0, 10, 15, 20, 30, 40, 45, 50][randInt(0, 7)];
  const duration = [25, 35, 40, 45, 50, 65, 75, 90][randInt(0, 7)];
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = startMinutes + duration;
  const endTime = formatTime(endMinutes);

  return {
    type: "input",
    prompt: `A lesson starts at ${formatTime(startMinutes)} and lasts ${duration} minutes. What time does it finish? (Use 24-hour format e.g. 14:05)`,
    placeholder: "HH:MM",
    evaluate: (value) => {
      const sanitized = value.trim();
      const match = sanitized.match(/^(\d{1,2}):(\d{1,2})$/);
      if (!match) {
        return { correct: false, correctAnswer: endTime };
      }
      const [, hours, minutes] = match;
      const formatted = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
      return {
        correct: formatted === endTime,
        correctAnswer: endTime,
      };
    },
    explanation: `Add ${duration} minutes to get ${endTime}.`,
  };
};

const generateNegativeNumberQuestion = () => {
  const a = randInt(-12, 12);
  const b = randInt(-12, 12);
  const c = randInt(-9, 9);
  const templates = [
    {
      expression: `${a} - (${b})`,
      answer: a - b,
    },
    {
      expression: `${a} + (${b})`,
      answer: a + b,
    },
    {
      expression: `${b} × (${c})`,
      answer: b * c,
    },
  ];
  const selected = templates[randInt(0, templates.length - 1)];
  return {
    type: "input",
    prompt: `Work out ${selected.expression}`,
    placeholder: "Enter a number",
    evaluate: numericEvaluate(selected.answer),
    explanation: `The correct value of ${selected.expression} is ${selected.answer}.`,
  };
};

const generatePowersQuestion = () => {
  const base = randInt(2, 12);
  const variants = [
    {
      prompt: `What is ${base}² ?`,
      answer: base ** 2,
    },
    {
      prompt: `What is ${base}³ ?`,
      answer: base ** 3,
    },
  ];
  const sqrtTarget = [4, 9, 16, 25, 36, 49, 64, 81][randInt(0, 7)];
  variants.push({
    prompt: `What is √${sqrtTarget}?`,
    answer: Math.sqrt(sqrtTarget),
  });
  const chosen = variants[randInt(0, variants.length - 1)];
  return {
    type: "input",
    prompt: chosen.prompt,
    placeholder: "Enter the value",
    evaluate: numericEvaluate(chosen.answer),
    explanation: `${chosen.prompt.replace("What is", "").trim()} equals ${
      chosen.answer
    }.`,
  };
};

const generateBidmasQuestion = () => {
  const a = randInt(2, 9);
  const b = randInt(2, 6);
  const c = randInt(1, 8);
  const d = randInt(1, 5);
  const templates = [
    {
      expression: `${a} + ${b} × ${c}`,
      answer: a + b * c,
    },
    {
      expression: `(${a} + ${b}) × ${c}`,
      answer: (a + b) * c,
    },
    {
      expression: `${a}² - ${c} × ${d}`,
      answer: a ** 2 - c * d,
    },
    {
      expression: `${a} + ${b}² ÷ ${c}`,
      answer: a + (b ** 2) / c,
    },
  ];
  const selected = templates[randInt(0, templates.length - 1)];
  return {
    type: "input",
    prompt: `Work out ${selected.expression}`,
    placeholder: "Use BIDMAS",
    evaluate: numericEvaluate(selected.answer),
    explanation: `Follow BIDMAS to evaluate ${selected.expression} = ${selected.answer}.`,
  };
};

const generateFactorsQuestion = () => {
  const a = randInt(6, 18);
  const b = randInt(6, 18);
  const hcf = gcd(a, b);
  const lcm = (a * b) / hcf;
  const options = shuffle([
    { id: choiceId(), label: `${hcf}`, value: "hcf" },
    { id: choiceId(), label: `${lcm}`, value: "lcm" },
    { id: choiceId(), label: `${a * 2}`, value: "double-a" },
    { id: choiceId(), label: `${b * 3}`, value: "triple-b" },
  ]).slice(0, 4);

  const correctChoice = options.find((opt) => opt.value === "lcm")?.id;
  return {
    type: "multiple",
    prompt: `Which number is a common multiple of ${a} and ${b}?`,
    choices: options,
    correctChoiceId: correctChoice,
    evaluate: (choice) => {
      const selected = options.find((opt) => opt.id === choice);
      const correct = selected?.value === "lcm";
      return {
        correct,
        correctAnswer: `${lcm}`,
      };
    },
    explanation: `The lowest common multiple of ${a} and ${b} is ${lcm}.`,
  };
};

const generateFractionsQuestion = () => {
  const numerator = randInt(2, 15);
  const denominator = randInt(numerator + 1, 24);
  const simplified = simplifyFraction(numerator, denominator);
  return {
    type: "input",
    prompt: `Simplify the fraction ${numerator}/${denominator}`,
    placeholder: "e.g. 2/3",
    evaluate: fractionEvaluate(simplified),
    explanation: `Divide numerator and denominator by ${gcd(
      numerator,
      denominator
    )} to get ${formatFraction(simplified)}.`,
  };
};

const generateCoordinatesQuestion = () => {
  const x = randInt(-6, 6);
  const y = randInt(-6, 6);
  const dx = randInt(-4, 4);
  const dy = randInt(-4, 4);
  const newPoint = `(${x + dx}, ${y + dy})`;
  return {
    type: "input",
    prompt: `Point A is at (${x}, ${y}). After a translation by the vector (${dx}, ${dy}), what are the new coordinates?`,
    placeholder: "(x, y)",
    evaluate: coordinateEvaluate(newPoint),
    explanation: `Add ${dx} to the x-coordinate and ${dy} to the y-coordinate to get ${newPoint}.`,
  };
};

const stage1Topics = [
  {
    slug: "stage1-place-value",
    title: "Place Value",
    helperLink: `${BASE_URL}/place-value.php`,
    description: "Identify the value of digits in large numbers.",
    generateQuestion: generatePlaceValueQuestion,
  },
  {
    slug: "stage1-time",
    title: "Time",
    helperLink: `${BASE_URL}/time.php`,
    description: "Add and interpret 24-hour times.",
    generateQuestion: generateTimeQuestion,
  },
  {
    slug: "stage1-negative-numbers",
    title: "Negative Numbers",
    helperLink: `${BASE_URL}/negativenumbers.php`,
    description: "Add, subtract, and multiply with negatives.",
    generateQuestion: generateNegativeNumberQuestion,
  },
  {
    slug: "stage1-powers",
    title: "Powers & Roots",
    helperLink: `${BASE_URL}/squares-cubes-and-roots.php`,
    description: "Recall squares, cubes, and roots.",
    generateQuestion: generatePowersQuestion,
  },
  {
    slug: "stage1-bidmas",
    title: "Order of Operations",
    helperLink: `${BASE_URL}/BIDMAS.php`,
    description: "Evaluate expressions using BIDMAS.",
    generateQuestion: generateBidmasQuestion,
  },
  {
    slug: "stage1-factors",
    title: "Factors & Multiples",
    helperLink: `${BASE_URL}/factors-multiples-and-primes.php`,
    description: "Reason about common multiples and factors.",
    generateQuestion: generateFactorsQuestion,
  },
  {
    slug: "stage1-fractions",
    title: "Fractions",
    helperLink: `${BASE_URL}/writing-fractions.php`,
    description: "Write and simplify fractions.",
    generateQuestion: generateFractionsQuestion,
  },
  {
    slug: "stage1-coordinates",
    title: "Coordinates",
    helperLink: `${BASE_URL}/coordinates.php`,
    description: "Translate points on the coordinate plane.",
    generateQuestion: generateCoordinatesQuestion,
  },
  {
    slug: "stage1-pictograms",
    title: "Pictograms",
    helperLink: `${BASE_URL}/pictograms.php`,
    description: "Read pictograms (requires image assets).",
    requiresAssets: true,
  },
];

export default stage1Topics;
