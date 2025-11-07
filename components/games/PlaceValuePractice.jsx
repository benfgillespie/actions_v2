'use client';

import React, { useState, useEffect } from 'react';
import { Timer, Award, RefreshCw, GripVertical } from 'lucide-react';

const PlaceValuePractice = ({ onProgress }) => {
  // State management
  const [difficulty, setDifficulty] = useState(1);
  const [timerDuration, setTimerDuration] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [questionType, setQuestionType] = useState('placeValue');
  const [bestStreak, setBestStreak] = useState(0);
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  
  // For drag and drop ordering
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [orderedItems, setOrderedItems] = useState([]);

  // Generate place value question
  const generatePlaceValueQuestion = (diff) => {
    const positions = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'];
    const positionValues = [1, 10, 100, 1000, 10000];
    
    let maxDigits = Math.min(3 + diff, 6);
    let includeDecimals = diff >= 2;
    let number;
    let targetPosition;
    let targetDigit;
    let positionName;
    let value;
    
    // Generate a number without repeated digits to avoid ambiguity
    do {
      if (includeDecimals && Math.random() < 0.4) {
        // Generate decimal number
        let intPart = Math.floor(Math.random() * Math.pow(10, Math.min(diff + 1, 4)));
        let decPart = Math.floor(Math.random() * 100);
        number = parseFloat(`${intPart}.${decPart}`);
        
        // For decimals, we'll ask about specific decimal places
        const numStr = number.toString();
        const parts = numStr.split('.');
        
        if (Math.random() < 0.5 && parts[0].length > 0) {
          // Ask about integer part
          targetPosition = Math.floor(Math.random() * parts[0].length);
          targetDigit = parts[0][parts[0].length - 1 - targetPosition];
          positionName = positions[targetPosition];
          value = parseInt(targetDigit) * positionValues[targetPosition];
        } else if (parts[1] && parts[1].length > 0) {
          // Ask about decimal part
          if (parts[1].length === 1 || Math.random() < 0.5) {
            targetDigit = parts[1][0];
            positionName = 'tenths';
            value = parseInt(targetDigit) * 0.1;
          } else {
            targetDigit = parts[1][1];
            positionName = 'hundredths';
            value = parseInt(targetDigit) * 0.01;
          }
        } else {
          continue;
        }
      } else {
        // Generate whole number
        const minNum = Math.pow(10, Math.min(diff, 2));
        const maxNum = Math.pow(10, maxDigits);
        number = Math.floor(Math.random() * (maxNum - minNum) + minNum);
        
        const numStr = number.toString();
        targetPosition = Math.floor(Math.random() * numStr.length);
        targetDigit = numStr[numStr.length - 1 - targetPosition];
        positionName = positions[targetPosition];
        value = parseInt(targetDigit) * positionValues[targetPosition];
      }
      
      // Check for repeated digits
      const digits = number.toString().replace('.', '').split('');
      const hasRepeated = digits.some((d, i) => digits.indexOf(d) !== i);
      
      if (!hasRepeated) break;
    } while (true);
    
    return {
      type: 'placeValue',
      question: `What is the value of the digit in the ${positionName} place in ${number}?`,
      display: number.toString(),
      answer: value.toString(),
      positionName: positionName
    };
  };

  // Generate ordering question
  const generateOrderingQuestion = (diff) => {
    const count = Math.min(3 + Math.floor(diff / 2), 6);
    let numbers = [];
    
    if (diff <= 2) {
      // Whole numbers only
      const max = diff === 1 ? 200 : 1000;
      const min = diff === 1 ? 10 : 100;
      
      while (numbers.length < count) {
        const num = Math.floor(Math.random() * (max - min) + min);
        if (!numbers.includes(num)) {
          numbers.push(num);
        }
      }
    } else {
      // Include decimals
      const useDecimals = diff >= 3;
      
      while (numbers.length < count) {
        let num;
        if (useDecimals && Math.random() < 0.6) {
          // Generate decimal
          const intPart = Math.floor(Math.random() * 10);
          const decPart = Math.floor(Math.random() * 1000);
          const places = diff === 3 ? 1 : (diff === 4 ? 2 : 3);
          num = parseFloat(`${intPart}.${decPart.toString().padStart(3, '0').slice(0, places)}`);
        } else {
          // Generate whole number
          const max = Math.pow(10, Math.min(diff, 4));
          num = Math.floor(Math.random() * max);
        }
        
        if (!numbers.includes(num)) {
          numbers.push(num);
        }
      }
    }
    
    const sortedNumbers = [...numbers].sort((a, b) => a - b);
    const shuffled = [...numbers].sort(() => Math.random() - 0.5);
    
    return {
      type: 'ordering',
      question: 'Order these numbers from smallest to largest:',
      items: shuffled,
      answer: sortedNumbers
    };
  };

  // Generate number creation question (like questions 6-8 in worksheet)
  const generateNumberCreationQuestion = (diff) => {
    const positions = ['tens', 'hundreds', 'thousands', 'ten thousands'];
    const digits = Math.min(3 + diff, 6);
    const positionIndex = Math.floor(Math.random() * Math.min(positions.length, digits - 1));
    const position = positions[positionIndex];
    const digitToUse = Math.floor(Math.random() * 9) + 1;
    
    // Calculate the answer pattern
    let answerPattern = Array(digits).fill('_');
    answerPattern[digits - positionIndex - 2] = digitToUse.toString();
    
    return {
      type: 'numberCreation',
      question: `Write a ${digits}-digit number that has ${digitToUse} in the ${position} place. Use ${digitToUse} only once.`,
      digits: digits,
      position: position,
      requiredDigit: digitToUse,
      positionIndex: positionIndex
    };
  };

  // Generate question based on type and difficulty
  const generateQuestion = (diff) => {
    const types = ['placeValue', 'ordering'];
    
    // At higher difficulties, add number creation questions
    if (diff >= 2) {
      types.push('numberCreation');
    }
    
    const type = types[Math.floor(Math.random() * types.length)];
    
    switch (type) {
      case 'placeValue':
        return generatePlaceValueQuestion(diff);
      case 'ordering':
        return generateOrderingQuestion(diff);
      case 'numberCreation':
        return generateNumberCreationQuestion(diff);
      default:
        return generatePlaceValueQuestion(diff);
    }
  };

  // Initialize first question
  useEffect(() => {
    const question = generateQuestion(difficulty);
    setCurrentQuestion(question);
    setQuestionType(question.type);
    if (question.type === 'ordering') {
      setOrderedItems([...question.items]);
    }
  }, []);

  // Timer logic
  useEffect(() => {
    if (timerDuration > 0 && timeLeft > 0 && !feedback) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timerDuration > 0 && timeLeft === 0 && !feedback) {
      handleTimeout();
    }
  }, [timeLeft, timerDuration, feedback]);

  // Handle timeout
  const handleTimeout = () => {
    setFeedback({ 
      type: 'incorrect', 
      message: `Time's up! The answer was: ${currentQuestion.answer}` 
    });
  };

  // Normalize answer for comparison
  const normalizeAnswer = (str) => {
    return str.toString().toLowerCase().replace(/\s+/g, '').trim();
  };

  // Validate number creation answer
  const validateNumberCreation = (answer, question) => {
    const normalized = normalizeAnswer(answer);
    
    // Check if it's a number
    if (!/^\d+$/.test(normalized)) return false;
    
    // Check if it has the right number of digits
    if (normalized.length !== question.digits) return false;
    
    // Check if the required digit is in the correct position
    const requiredPosition = question.digits - question.positionIndex - 2;
    if (normalized[requiredPosition] !== question.requiredDigit.toString()) return false;
    
    // Check that the required digit is used only once
    const digitCount = normalized.split('').filter(d => d === question.requiredDigit.toString()).length;
    if (digitCount !== 1) return false;
    
    return true;
  };

  // Check answer
  const checkAnswer = () => {
    let correct = false;
    let correctAnswer = '';
    
    if (currentQuestion.type === 'placeValue') {
      correct = normalizeAnswer(userAnswer) === normalizeAnswer(currentQuestion.answer);
      correctAnswer = currentQuestion.answer;
    } else if (currentQuestion.type === 'ordering') {
      correct = JSON.stringify(orderedItems) === JSON.stringify(currentQuestion.answer);
      correctAnswer = currentQuestion.answer.join(', ');
    } else if (currentQuestion.type === 'numberCreation') {
      correct = validateNumberCreation(userAnswer, currentQuestion);
      // Generate an example answer
      let example = Array(currentQuestion.digits).fill(0);
      example[currentQuestion.digits - currentQuestion.positionIndex - 2] = currentQuestion.requiredDigit;
      for (let i = 0; i < example.length; i++) {
        if (example[i] === 0) {
          let digit;
          do {
            digit = Math.floor(Math.random() * 9) + 1;
          } while (digit === currentQuestion.requiredDigit);
          example[i] = digit;
        }
      }
      correctAnswer = `Example: ${example.join('')}`;
    }
    
    const newScore = correct ? score + 1 : score;
    const newQuestionsAnswered = questionsAnswered + 1;
    const newConsecutiveCorrect = correct ? consecutiveCorrect + 1 : 0;
    
    setScore(newScore);
    setQuestionsAnswered(newQuestionsAnswered);
    setConsecutiveCorrect(newConsecutiveCorrect);
    setBestStreak((prev) => Math.max(prev, newConsecutiveCorrect));
    
    const accuracy = (newScore / newQuestionsAnswered) * 100;
    
    if (correct) {
      setFeedback({ type: 'correct', message: 'Correct! Well done!' });
      
      // Adaptive difficulty
      if (newConsecutiveCorrect >= 3 && accuracy > 85 && difficulty < 5) {
        setDifficulty(difficulty + 1);
        setConsecutiveCorrect(0);
      }
      
      setTimeout(() => {
        nextQuestion();
      }, 2000);
      
    } else {
      setFeedback({ 
        type: 'incorrect', 
        message: `Not quite. The answer is: ${correctAnswer}` 
      });
      
      if (accuracy < 85 && difficulty > 1) {
        setDifficulty(difficulty - 1);
      }
    }
  };

  // Next question
  const nextQuestion = () => {
    const question = generateQuestion(difficulty);
    setCurrentQuestion(question);
    setQuestionType(question.type);
    setUserAnswer('');
    setFeedback(null);
    
    if (question.type === 'ordering') {
      setOrderedItems([...question.items]);
    }
    
    if (timerDuration > 0) {
      setTimeLeft(timerDuration);
    }
  };

  // Reset quiz
  const resetQuiz = () => {
    setScore(0);
    setQuestionsAnswered(0);
    setConsecutiveCorrect(0);
    setBestStreak(0);
    setSessionStart(Date.now());
    setUserAnswer('');
    setFeedback(null);
    const question = generateQuestion(difficulty);
    setCurrentQuestion(question);
    setQuestionType(question.type);
    if (question.type === 'ordering') {
      setOrderedItems([...question.items]);
    }
    if (timerDuration > 0) {
      setTimeLeft(timerDuration);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
      
      // Reorder items while dragging
      const draggedItem = orderedItems[draggedIndex];
      const newItems = [...orderedItems];
      newItems.splice(draggedIndex, 1);
      newItems.splice(index, 0, draggedItem);
      setOrderedItems(newItems);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    if (!onProgress || questionsAnswered === 0) return;
    const result = onProgress({
      score,
      accuracy: questionsAnswered === 0 ? 0 : score / questionsAnswered,
      questionsAnswered,
      streak: bestStreak,
      elapsedSeconds: Math.max(1, Math.round((Date.now() - sessionStart) / 1000)),
      completedAt: new Date().toISOString(),
    });
    if (result?.catch) {
      result.catch(() => {});
    }
  }, [onProgress, questionsAnswered, score, bestStreak, sessionStart]);

  // Calculate accuracy
  const accuracy = questionsAnswered > 0 ? Math.round((score / questionsAnswered) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Brand Name */}
        <div className="text-center mb-4">
          <p className="text-indigo-600 font-semibold tracking-wide">Ben's Maths</p>
          <h1 className="text-3xl lg:text-4xl font-bold text-indigo-900 mt-2">
            Place Value & Ordering Practice
          </h1>
          <p className="text-gray-600 mt-2 text-sm lg:text-base">
            Stage 1 - Identify place values and order numbers
          </p>
        </div>

        {/* Layout container */}
        <div className="lg:flex lg:gap-6">
          {/* Settings Sidebar - Desktop */}
          <div className="hidden lg:block lg:w-80 lg:flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Settings</h2>
              
              <div className="space-y-4">
                {/* Difficulty Slider */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Difficulty Level: {difficulty}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={difficulty}
                    onChange={(e) => setDifficulty(parseInt(e.target.value))}
                    className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                    disabled={feedback !== null}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Easier</span>
                    <span>Harder</span>
                  </div>
                </div>

                {/* Timer Slider */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Timer: {timerDuration > 0 ? `${timerDuration}s` : 'Off'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="10"
                    value={timerDuration}
                    onChange={(e) => setTimerDuration(parseInt(e.target.value))}
                    className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                    disabled={feedback !== null}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Off</span>
                    <span>60s</span>
                  </div>
                </div>

                {/* Reset Button */}
                <button
                  onClick={resetQuiz}
                  className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset Quiz
                </button>
              </div>
            </div>
          </div>

          {/* Settings - Mobile Compact */}
          <div className="block lg:hidden bg-white rounded-xl shadow-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 font-medium">Difficulty: {difficulty}</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={difficulty}
                  onChange={(e) => setDifficulty(parseInt(e.target.value))}
                  className="w-full h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer mt-1"
                  disabled={feedback !== null}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 font-medium">
                  Timer: {timerDuration > 0 ? `${timerDuration}s` : 'Off'}
                </label>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="10"
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(parseInt(e.target.value))}
                  className="w-full h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer mt-1"
                  disabled={feedback !== null}
                />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 bg-white rounded-xl lg:rounded-2xl shadow-2xl p-6 lg:p-8">
            {/* Score Panel */}
            <div className="bg-indigo-50 rounded-xl p-4 mb-6 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <span className="text-gray-700 font-medium">
                  Score: {score}/{questionsAnswered}
                </span>
              </div>
              <span className="text-gray-700">Accuracy: {accuracy}%</span>
              {timerDuration > 0 && (
                <div className="flex items-center gap-2">
                  <Timer className={`w-5 h-5 ${timeLeft <= 5 ? 'text-red-500' : 'text-gray-600'}`} />
                  <span className={`font-medium ${timeLeft <= 5 ? 'text-red-500' : 'text-gray-700'}`}>
                    {timeLeft}s
                  </span>
                </div>
              )}
            </div>

            {/* Question Display */}
            {currentQuestion && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl lg:rounded-2xl p-6 lg:p-8 mb-6 shadow-lg">
                <div className="text-white text-2xl lg:text-3xl font-bold text-center">
                  {currentQuestion.question}
                </div>
                {currentQuestion.type === 'placeValue' && (
                  <div className="text-white text-4xl lg:text-5xl font-bold text-center mt-4">
                    {currentQuestion.display}
                  </div>
                )}
              </div>
            )}

            {/* Answer Input */}
            {currentQuestion && (
              <div className="mb-6">
                {currentQuestion.type === 'placeValue' && (
                  <>
                    <label className="block text-gray-700 font-medium mb-2">
                      Your Answer:
                    </label>
                    <input
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !feedback && checkAnswer()}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                      placeholder="Enter the value"
                      disabled={feedback !== null}
                    />
                  </>
                )}

                {currentQuestion.type === 'ordering' && (
                  <div className="space-y-3">
                    <label className="block text-gray-700 font-medium mb-2">
                      Drag to reorder:
                    </label>
                    {orderedItems.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        draggable={!feedback}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                        className={`p-4 bg-white border-2 rounded-xl shadow-sm cursor-grab active:cursor-grabbing transition-all duration-300 ease-out flex items-center gap-3
                          ${draggedIndex === index ? 'opacity-50 shadow-lg scale-105' : ''}
                          ${dragOverIndex === index ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300'}
                          ${feedback ? 'cursor-not-allowed' : 'hover:border-indigo-400'}
                        `}
                      >
                        {!feedback && <GripVertical className="w-5 h-5 text-gray-400" />}
                        <span className="text-lg font-medium text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'numberCreation' && (
                  <>
                    <label className="block text-gray-700 font-medium mb-2">
                      Your Answer:
                    </label>
                    <input
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !feedback && checkAnswer()}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                      placeholder={`Enter a ${currentQuestion.digits}-digit number`}
                      disabled={feedback !== null}
                      maxLength={currentQuestion.digits}
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Remember: Use {currentQuestion.requiredDigit} only once, in the {currentQuestion.position} place
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`p-4 rounded-xl mb-6 ${
                feedback.type === 'correct' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                <p className="text-center font-medium">{feedback.message}</p>
              </div>
            )}

            {/* Action Buttons */}
            {!feedback && currentQuestion && (
              <button
                onClick={checkAnswer}
                disabled={
                  (currentQuestion.type !== 'ordering' && !userAnswer.trim()) ||
                  (currentQuestion.type === 'ordering' && orderedItems.length === 0)
                }
                className="w-full bg-indigo-600 text-white font-bold text-lg py-4 px-6 rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                Check Answer
              </button>
            )}

            {feedback && feedback.type === 'incorrect' && (
              <button
                onClick={nextQuestion}
                className="w-full bg-indigo-600 text-white font-bold text-lg py-4 px-6 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
              >
                Next Question
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaceValuePractice;
