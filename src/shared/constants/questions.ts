import { Question } from '../types/game';

export const QUESTION_POOL: Question[] = [
  {
    id: "q001",
    text: "What year did the French Revolution begin?",
    category: "History",
    correctAnswer: "1789",
    date: ""
  },
  {
    id: "q002", 
    text: "What is the chemical symbol for gold?",
    category: "Science",
    correctAnswer: "Au",
    date: ""
  },
  {
    id: "q003",
    text: "Who painted the Mona Lisa?",
    category: "Art",
    correctAnswer: "Leonardo da Vinci",
    date: ""
  },
  {
    id: "q004",
    text: "What is the capital of Australia?",
    category: "Geography",
    correctAnswer: "Canberra",
    date: ""
  },
  {
    id: "q005",
    text: "How many planets are in our solar system?",
    category: "Science",
    correctAnswer: "8",
    date: ""
  },
  {
    id: "q006",
    text: "Who wrote Romeo and Juliet?",
    category: "Literature",
    correctAnswer: "William Shakespeare",
    date: ""
  },
  {
    id: "q007",
    text: "What is the largest ocean on Earth?",
    category: "Geography",
    correctAnswer: "Pacific Ocean",
    date: ""
  },
  {
    id: "q008",
    text: "In which year did World War II end?",
    category: "History",
    correctAnswer: "1945",
    date: ""
  },
  {
    id: "q009",
    text: "What is the speed of light in vacuum?",
    category: "Science",
    correctAnswer: "299,792,458 meters per second",
    date: ""
  },
  {
    id: "q010",
    text: "Who was the first person to walk on the moon?",
    category: "Science",
    correctAnswer: "Neil Armstrong",
    date: ""
  },
  {
    id: "q011",
    text: "What is the smallest country in the world?",
    category: "Geography",
    correctAnswer: "Vatican City",
    date: ""
  },
  {
    id: "q012",
    text: "Who composed the Four Seasons?",
    category: "Music",
    correctAnswer: "Antonio Vivaldi",
    date: ""
  },
  {
    id: "q013",
    text: "What is the capital of Japan?",
    category: "Geography",
    correctAnswer: "Tokyo",
    date: ""
  },
  {
    id: "q014",
    text: "In which year did the Titanic sink?",
    category: "History",
    correctAnswer: "1912",
    date: ""
  },
  {
    id: "q015",
    text: "What is the chemical formula for water?",
    category: "Science",
    correctAnswer: "H2O",
    date: ""
  },
  {
    id: "q016",
    text: "Who painted Starry Night?",
    category: "Art",
    correctAnswer: "Vincent van Gogh",
    date: ""
  },
  {
    id: "q017",
    text: "What is the largest mammal in the world?",
    category: "Science",
    correctAnswer: "Blue whale",
    date: ""
  },
  {
    id: "q018",
    text: "Who wrote The Great Gatsby?",
    category: "Literature",
    correctAnswer: "F. Scott Fitzgerald",
    date: ""
  },
  {
    id: "q019",
    text: "What is the capital of Egypt?",
    category: "Geography",
    correctAnswer: "Cairo",
    date: ""
  },
  {
    id: "q020",
    text: "In which year did the Berlin Wall fall?",
    category: "History",
    correctAnswer: "1989",
    date: ""
  },
  {
    id: "q021",
    text: "What is the hardest natural substance on Earth?",
    category: "Science",
    correctAnswer: "Diamond",
    date: ""
  },
  {
    id: "q022",
    text: "Who composed Beethoven's 5th Symphony?",
    category: "Music",
    correctAnswer: "Ludwig van Beethoven",
    date: ""
  },
  {
    id: "q023",
    text: "What is the largest desert in the world?",
    category: "Geography",
    correctAnswer: "Antarctica",
    date: ""
  },
  {
    id: "q024",
    text: "Who was the first President of the United States?",
    category: "History",
    correctAnswer: "George Washington",
    date: ""
  },
  {
    id: "q025",
    text: "What is the chemical symbol for silver?",
    category: "Science",
    correctAnswer: "Ag",
    date: ""
  },
  {
    id: "q026",
    text: "Who wrote Don Quixote?",
    category: "Literature",
    correctAnswer: "Miguel de Cervantes",
    date: ""
  },
  {
    id: "q027",
    text: "What is the capital of Brazil?",
    category: "Geography",
    correctAnswer: "Brasília",
    date: ""
  },
  {
    id: "q028",
    text: "In which year did Christopher Columbus reach the Americas?",
    category: "History",
    correctAnswer: "1492",
    date: ""
  },
  {
    id: "q029",
    text: "What is the fastest land animal?",
    category: "Science",
    correctAnswer: "Cheetah",
    date: ""
  },
  {
    id: "q030",
    text: "Who painted The Persistence of Memory?",
    category: "Art",
    correctAnswer: "Salvador Dalí",
    date: ""
  }
];

export const CATEGORIES = [
  "History",
  "Science", 
  "Art",
  "Geography",
  "Literature",
  "Music",
  "Pop Culture",
  "Sports",
  "Random"
];

export const PHASE_DURATION = {
  SUBMISSION: 12 * 60 * 60 * 1000, // 12 hours in milliseconds
  VOTING: 12 * 60 * 60 * 1000, // 12 hours in milliseconds
  RESULTS: 0 // Results phase ends when next day starts
};

export const MAX_ANSWER_LENGTH = 280;
export const MAX_VOTES_PER_PLAYER = 3;
