// Default word lists for the typing test

const commonWords = [
  'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'and', 'they',
  'are', 'very', 'good', 'at', 'running', 'around', 'in', 'circles', 'while', 'being',
  'watched', 'by', 'people', 'who', 'enjoy', 'seeing', 'animals', 'play', 'together',
  'during', 'sunny', 'days', 'when', 'weather', 'is', 'perfect', 'for', 'outdoor',
  'activities', 'like', 'walking', 'jogging', 'or', 'playing', 'games', 'with', 'friends',
  'family', 'members', 'neighbors', 'from', 'nearby', 'houses', 'buildings', 'apartments',
  'that', 'have', 'been', 'built', 'recently', 'using', 'modern', 'construction', 'methods',
  'which', 'make', 'them', 'more', 'efficient', 'comfortable', 'safe', 'secure', 'than',
  'older', 'structures', 'found', 'throughout', 'many', 'cities', 'towns', 'villages',
  'across', 'different', 'countries', 'continents', 'around', 'world', 'where', 'millions',
  'of', 'humans', 'live', 'work', 'study', 'learn', 'grow', 'develop', 'their', 'skills',
  'knowledge', 'understanding', 'about', 'various', 'subjects', 'topics', 'areas', 'fields',
  'disciplines', 'professions', 'careers', 'jobs', 'occupations', 'roles', 'responsibilities'
];

const technicalWords = [
  'algorithm', 'function', 'variable', 'boolean', 'integer', 'string', 'array', 'object',
  'method', 'class', 'interface', 'inheritance', 'polymorphism', 'encapsulation', 'abstraction',
  'framework', 'library', 'module', 'package', 'dependency', 'repository', 'version', 'control',
  'database', 'query', 'schema', 'table', 'column', 'primary', 'foreign', 'key', 'index',
  'server', 'client', 'request', 'response', 'protocol', 'endpoint', 'middleware', 'authentication',
  'authorization', 'encryption', 'decryption', 'hash', 'token', 'session', 'cookie', 'cache',
  'performance', 'optimization', 'scalability', 'reliability', 'availability', 'consistency',
  'transaction', 'atomic', 'concurrent', 'parallel', 'asynchronous', 'synchronous', 'thread',
  'process', 'memory', 'storage', 'network', 'bandwidth', 'latency', 'throughput', 'load',
  'testing', 'debugging', 'logging', 'monitoring', 'deployment', 'production', 'staging',
  'development', 'integration', 'continuous', 'delivery', 'devops', 'infrastructure', 'cloud'
];

const codingWords = [
  'const', 'let', 'var', 'function', 'arrow', 'return', 'import', 'export', 'default',
  'async', 'await', 'promise', 'then', 'catch', 'finally', 'try', 'throw', 'error',
  'if', 'else', 'switch', 'case', 'break', 'continue', 'for', 'while', 'do', 'loop',
  'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every', 'includes', 'indexOf',
  'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat', 'join', 'split',
  'length', 'prototype', 'constructor', 'this', 'new', 'instanceof', 'typeof', 'undefined',
  'null', 'true', 'false', 'NaN', 'Infinity', 'parseInt', 'parseFloat', 'isNaN',
  'JSON', 'parse', 'stringify', 'Math', 'random', 'floor', 'ceil', 'round', 'abs',
  'console', 'log', 'warn', 'error', 'info', 'debug', 'trace', 'assert', 'clear',
  'document', 'window', 'element', 'getElementById', 'querySelector', 'addEventListener',
  'createElement', 'appendChild', 'innerHTML', 'textContent', 'style', 'className'
];

const quotes = [
  'The only way to do great work is to love what you do.',
  'Innovation distinguishes between a leader and a follower.',
  'Stay hungry, stay foolish.',
  'The future belongs to those who believe in the beauty of their dreams.',
  'It is during our darkest moments that we must focus to see the light.',
  'Success is not final, failure is not fatal, it is the courage to continue that counts.',
  'The only impossible journey is the one you never begin.',
  'In the middle of difficulty lies opportunity.',
  'Life is what happens to you while you are busy making other plans.',
  'The way to get started is to quit talking and begin doing.'
];

const defaultWordLists = [
  {
    name: 'Common English Words',
    description: 'Most frequently used English words for general typing practice',
    category: 'common',
    language: 'english',
    words: commonWords,
    difficulty: 'easy',
    isCustom: false,
    isPublic: true,
    isSystem: true,
    isActive: true,
    wordCount: commonWords.length
  },
  {
    name: 'Technical Terms',
    description: 'Technical vocabulary for programmers and IT professionals',
    category: 'technical',
    language: 'english',
    words: technicalWords,
    difficulty: 'medium',
    isCustom: false,
    isPublic: true,
    isSystem: true,
    isActive: true,
    wordCount: technicalWords.length
  },
  {
    name: 'Programming Keywords',
    description: 'Common programming language keywords and syntax',
    category: 'coding',
    language: 'english',
    words: codingWords,
    difficulty: 'medium',
    isCustom: false,
    isPublic: true,
    isSystem: true,
    isActive: true,
    wordCount: codingWords.length
  },
  {
    name: 'Inspirational Quotes',
    description: 'Motivational quotes to practice sentence-level typing',
    category: 'quotes',
    language: 'english',
    words: quotes,
    difficulty: 'hard',
    isCustom: false,
    isPublic: true,
    isSystem: true,
    isActive: true,
    wordCount: quotes.length
  }
];

module.exports = {
  defaultWordLists,
  commonWords,
  technicalWords,
  codingWords,
  quotes
};