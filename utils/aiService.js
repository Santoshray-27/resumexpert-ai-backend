/**
 * AI Service Module
 * Handles all AI operations: resume analysis, job matching, interview Q&A
 * Supports both Gemini and OpenAI with graceful fallback to rule-based analysis
 */

// node-fetch is required per-call to avoid ESM/CJS issues

// ========================
// Gemini API Call (using node-fetch)

// ========================
const callGemini = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const fetch = require('node-fetch');
  // Using gemini-1.5-flash as it is more widely available for free tier keys
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9, // Higher randomness for uniqueness
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    }),
    timeout: 45000
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('❌ Gemini Error Body:', errText);
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Gemini API error');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned empty response');
  return text;
};

// ========================
// OpenAI API Call
// ========================
const callOpenAI = async (prompt) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const fetch = require('node-fetch');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert HR consultant and ATS specialist. Provide unique, critical, and non-generic analysis every time.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
      max_tokens: 4096,
      response_format: { type: "json_object" }
    }),
    timeout: 45000
  });

  const data = await response.json();

  if (data.error) {
    console.error('❌ OpenAI Error Body:', JSON.stringify(data.error));
    throw new Error(data.error.message || 'OpenAI API error');
  }

  return data.choices?.[0]?.message?.content || '';
};

// ========================
// Groq API Call
// ========================
const callGroq = async (prompt) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY not configured');
  }

  const fetch = require('node-fetch');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant', // Highly stable and active model
      messages: [
        {
          role: 'system',
          content: 'You are an expert HR consultant. Provide highly unique, detailed, and critical analysis. Avoid repetitive phrases.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
      max_tokens: 4096,
      response_format: { type: "json_object" }
    }),
    timeout: 45000
  });

  const data = await response.json();

  if (data.error) {
    console.error('❌ Groq Error Body:', JSON.stringify(data.error));
    throw new Error(data.error.message || 'Groq API error');
  }

  return data.choices?.[0]?.message?.content || '';
};

// ========================
// Call AI with Fallback
// ========================
const callAI = async (prompt) => {
  console.log('--- AI Analysis Attempt ---');
  console.log('Checking Keys:', {
    gemini: !!process.env.GEMINI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    groq: !!process.env.GROQ_API_KEY
  });

  // 1. Try Gemini first (most cost-effective)
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing in .env');
    const result = await callGemini(prompt);
    console.log('✅ AI Response from Gemini');
    return { text: result, model: 'gemini' };
  } catch (geminiError) {
    console.warn(`⚠️ Gemini failed (${process.env.GEMINI_API_KEY ? 'Key present' : 'Key missing'}):`, geminiError.message);
  }

  // 2. Try OpenAI second
  try {
    const result = await callOpenAI(prompt);
    console.log('✅ AI Response from OpenAI');
    return { text: result, model: 'openai' };
  } catch (openaiError) {
    console.warn('⚠️ OpenAI failed:', openaiError.message);
  }

  // 3. Try Groq third
  try {
    const result = await callGroq(prompt);
    console.log('✅ AI Response from Groq');
    return { text: result, model: 'groq' };
  } catch (groqError) {
    console.error('❌ All AI providers failed:', groqError.message);
  }

  // Return null to indicate all AI providers failed
  return null;
};

// ========================
// Parse JSON from AI response
// ========================
const parseAIJson = (text) => {
  if (!text) return null;
  const cleanText = text.trim();
  
  try {
    // 1. Try to find JSON inside markdown blocks
    const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1].trim()); } catch (e) {}
    }

    // 2. Try direct parse
    try { return JSON.parse(cleanText); } catch (e) {}

    // 3. Find the first '{' or '[' and the last '}' or ']'
    const firstBrace = cleanText.indexOf('{');
    const firstBracket = cleanText.indexOf('[');
    const lastBrace = cleanText.lastIndexOf('}');
    const lastBracket = cleanText.lastIndexOf(']');

    // Determine if it's an object or array
    const startObj = firstBrace !== -1 ? firstBrace : Infinity;
    const startArr = firstBracket !== -1 ? firstBracket : Infinity;

    if (startObj < startArr && lastBrace > firstBrace) {
      try { return JSON.parse(cleanText.substring(firstBrace, lastBrace + 1)); } catch (e) {}
    }
    if (startArr < startObj && lastBracket > firstBracket) {
      try { return JSON.parse(cleanText.substring(firstBracket, lastBracket + 1)); } catch (e) {}
    }
    // Fallback: try either
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try { return JSON.parse(cleanText.substring(firstBrace, lastBrace + 1)); } catch (e) {}
    }
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try { return JSON.parse(cleanText.substring(firstBracket, lastBracket + 1)); } catch (e) {}
    }

    return null;
  } catch (e) {
    console.error('Final JSON parsing error:', e.message);
    return null;
  }
};

/**
 * Fallback Mock Data for Resume Analysis
 */
const getFallbackAnalysis = (resumeText = '') => {
  return {
    atsScore: 72,
    scoreBreakdown: {
      formatting: 85,
      keywords: 65,
      experience: 70,
      skills: 75,
      education: 90,
      overall: 72
    },
    strengths: [
      "Clear and professional formatting with good use of white space",
      "Strong educational background with relevant degree",
      "Presence of key technical skills like React and Node.js"
    ],
    weaknesses: [
      "Lack of quantifiable achievements in experience bullet points",
      "Summary section is a bit generic and could be more impactful",
      "Limited mention of cloud infrastructure or DevOps tools"
    ],
    missingSkills: ["AWS", "Docker", "CI/CD", "TypeScript", "Unit Testing"],
    suggestions: [
      "Add metrics to your achievements (e.g., 'Improved performance by 20%')",
      "Tailor your summary to highlight your unique value proposition",
      "Include more project-based experience to showcase practical skills"
    ],
    sectionFeedback: {
      summary: "Good start, but needs to be more specific to your target role.",
      experience: "Well-structured, but needs more focus on results rather than just duties.",
      skills: "Broad range of skills, but could be grouped more logically.",
      education: "Strong academic record, clearly presented.",
      formatting: "Professional and easy to scan for both humans and ATS."
    },
    keywordsFound: ["React", "Node.js", "MongoDB", "JavaScript", "HTML", "CSS"],
    keywordsMissing: ["TypeScript", "AWS", "Docker", "Kubernetes", "Microservices"],
    keywordDensity: 65,
    industryMatch: 75
  };
};

/**
 * Fallback Mock Data for Resume Screening
 */
const getFallbackScreening = (jobTitle = 'the role') => {
  return {
    verdict: "maybe",
    matchScore: 68,
    summary: `The candidate has a solid foundation in the core technologies required for ${jobTitle}, but lacks some of the advanced infrastructure experience mentioned in the job description.`,
    matchedRequirements: [
      { requirement: "Proficiency in JavaScript and React", status: "met", evidence: "Mentioned multiple times in experience and skills sections." },
      { requirement: "Experience with Backend development (Node.js)", status: "met", evidence: "Documented experience building APIs with Express." },
      { requirement: "Cloud infrastructure experience (AWS/Azure)", status: "unmet", evidence: "No specific mention of cloud provider services found." }
    ],
    strengths: ["Strong React background", "Full-stack project experience", "Good academic credentials"],
    redFlags: ["No mention of automated testing", "Short tenure in most recent role"],
    experienceMatch: {
      requiredYears: 3,
      estimatedYears: 2,
      relevanceScore: 70
    },
    skillsAnalysis: {
      matched: ["React", "Node.js", "JavaScript", "MongoDB"],
      missing: ["AWS", "TypeScript", "Jest", "Docker"],
      bonus: ["Python", "SQL"]
    },
    cultureFitIndicators: ["Collaborative mindset", "Continuous learner"],
    recommendation: "Worth a screening call to evaluate their technical depth in backend systems and their willingness to learn cloud infrastructure.",
    interviewFocus: ["Scalability challenges they have faced", "Testing strategies", "Cloud fundamentals"]
  };
};

/**
 * Fallback Mock Data for Skill Gap Analysis
 */
const getFallbackSkillGap = (targetRole = 'Target Role') => {
  return {
    overallReadiness: 65,
    readinessLevel: "developing",
    summary: `You have about 65% of the skills required for a ${targetRole} role. Your core development skills are strong, but you need to focus on enterprise-level tools and architecture.`,
    skillCategories: [
      {
        category: "Core Technical Skills",
        currentLevel: 80,
        requiredLevel: 90,
        gap: 10,
        skills: [
          { name: "React", current: 85, required: 90, priority: "critical", status: "adequate" },
          { name: "Node.js", current: 75, required: 85, priority: "critical", status: "weak" }
        ]
      },
      {
        category: "Architecture & DevOps",
        currentLevel: 30,
        requiredLevel: 75,
        gap: 45,
        skills: [
          { name: "Docker", current: 20, required: 70, priority: "important", status: "missing" },
          { name: "AWS", current: 10, required: 80, priority: "critical", status: "missing" }
        ]
      }
    ],
    learningPath: [
      { step: 1, skill: "TypeScript Deep Dive", resource: "Official Docs & Udemy Course", timeEstimate: "2 weeks", priority: "critical" },
      { step: 2, skill: "AWS Certified Developer Associate", resource: "A Cloud Guru", timeEstimate: "6 weeks", priority: "critical" }
    ],
    strengthsToLeverage: ["Solid JavaScript fundamentals", "Experience with modern UI frameworks"],
    criticalGaps: ["Cloud infrastructure knowledge", "TypeScript proficiency in large codebases"],
    marketInsights: {
      demandLevel: "high",
      salaryRange: "$100,000 - $140,000",
      growthOutlook: "Excellent growth as companies move to cloud-native architectures.",
      topEmployers: ["Tech Giants", "FinTech Startups", "E-commerce Platforms"]
    },
    timeToReady: "3-5 months",
    certifications: [
      { name: "AWS Certified Developer", provider: "Amazon", importance: "critical" }
    ]
  };
};

/**
 * Fallback Mock Data for Interview Questions
 */
const getFallbackQuestions = (jobTitle = 'Software Engineer') => {
  return [
    {
      question: "Explain the difference between Virtual DOM and Real DOM in React.",
      format: "open-ended",
      options: [],
      type: "technical",
      difficulty: "medium",
      expectedAnswer: "Virtual DOM is a lightweight copy of the Real DOM. React uses it to improve performance by only updating the necessary parts of the Real DOM.",
      followUpQuestions: ["What is reconciliation?", "How does 'key' prop help?"]
    },
    {
      question: "Describe a challenging technical problem you solved recently.",
      format: "open-ended",
      options: [],
      type: "behavioral",
      difficulty: "medium",
      expectedAnswer: "Look for STAR method (Situation, Task, Action, Result) and specific technical depth.",
      followUpQuestions: ["What would you do differently now?", "How did you measure success?"]
    },
    {
      question: "What is the primary purpose of middleware in Express.js?",
      format: "mcq",
      options: ["To connect to the database", "To execute code between request and response", "To compile CSS files", "To manage hardware resources"],
      type: "technical",
      difficulty: "easy",
      expectedAnswer: "To execute code between request and response",
      followUpQuestions: []
    }
  ];
};

/**
 * Fallback Mock Data for Job Recommendations
 */
const getFallbackJobs = (skills = []) => {
  const skillStr = skills.slice(0, 3).join(' & ') || 'your profile';
  return [
    {
      title: 'Full Stack Developer',
      company: 'TechFlow Systems',
      location: 'Remote / Hybrid',
      type: 'Full-time',
      salary: '$90,000 - $130,000',
      matchScore: 92,
      requiredSkills: ['React', 'Node.js', 'TypeScript', 'MongoDB'],
      description: 'Join a fast-growing team building next-generation web applications. Work across the entire stack from UI to database.',
      whyMatch: `Strong alignment with your expertise in ${skillStr}.`,
      industry: 'Software',
      experienceLevel: 'Mid'
    },
    {
      title: 'Software Engineer II',
      company: 'CloudScale AI',
      location: 'San Francisco, CA',
      type: 'Full-time',
      salary: '$110,000 - $150,000',
      matchScore: 88,
      requiredSkills: ['JavaScript', 'Python', 'AWS', 'Docker'],
      description: 'Help us scale our AI infrastructure to support millions of concurrent users. Focus on performance and reliability.',
      whyMatch: 'Your background in modern web technologies is a great fit for our current architecture.',
      industry: 'Artificial Intelligence',
      experienceLevel: 'Mid-Senior'
    },
    {
      title: 'Frontend Engineer',
      company: 'DesignFirst Studio',
      location: 'Austin, TX',
      type: 'Full-time',
      salary: '$85,000 - $120,000',
      matchScore: 85,
      requiredSkills: ['React', 'CSS', 'Figma', 'Tailwind'],
      description: 'Create pixel-perfect, highly interactive user interfaces. Collaborate closely with designers to bring visions to life.',
      whyMatch: 'Excellent match for your frontend development skills and attention to detail.',
      industry: 'Creative Tech',
      experienceLevel: 'Junior-Mid'
    },
    {
      title: 'Backend Developer',
      company: 'DataStream Corp',
      location: 'New York, NY',
      type: 'Full-time',
      salary: '$95,000 - $135,000',
      matchScore: 82,
      requiredSkills: ['Node.js', 'PostgreSQL', 'Redis', 'GraphQL'],
      description: 'Build robust APIs and microservices handling high-volume data streams. Optimize query performance and system uptime.',
      whyMatch: 'Your experience with backend systems and database management is highly relevant.',
      industry: 'FinTech',
      experienceLevel: 'Mid'
    },
    {
      title: 'DevOps Engineer',
      company: 'Nexus Cloud',
      location: 'Seattle, WA',
      type: 'Full-time',
      salary: '$100,000 - $145,000',
      matchScore: 78,
      requiredSkills: ['Docker', 'Kubernetes', 'CI/CD', 'Terraform'],
      description: 'Manage our multi-cloud infrastructure and improve deployment pipelines for automated shipping.',
      whyMatch: 'Strong engineering fundamentals that translate well to cloud infrastructure management.',
      industry: 'Infrastructure',
      experienceLevel: 'Mid'
    }
  ];
};


// ========================
// 1. RESUME ANALYSIS
// ========================
const analyzeResume = async (resumeText, jobTitle = '', jobDescription = '') => {
  const startTime = Date.now();

  // Send more of the resume for better unique analysis
  const resumeExcerpt = resumeText.substring(0, 6000);

  const prompt = `
You are an expert ATS (Applicant Tracking System) analyst and career coach.
Analyze this SPECIFIC resume and return a highly personalized, CRITICAL, and UNIQUE JSON analysis. 
Base ALL responses on the ACTUAL CONTENT of the resume provided — do NOT use generic feedback or templates.
BE CRITICAL: If a section is weak, give a low score and explain exactly why. Do not be overly generous with scores.
Every analysis should be distinct and reflect the subtle nuances of the document.

RESUME TEXT:
---
${resumeExcerpt}
---

${jobTitle ? `TARGET JOB TITLE: ${jobTitle}` : 'No specific job title provided — analyze for general job market fit.'}
${jobDescription ? `\nJOB DESCRIPTION:\n${jobDescription.substring(0, 1500)}` : ''}

Instructions:
- Reference SPECIFIC details from the resume (actual company names, skills mentioned, experience described)
- Strengths and weaknesses MUST be based on what is actually written in this resume
- Missing skills should be inferred from what IS in the resume vs what is needed
- Suggestions must be specific and actionable for THIS resume
- ATS score must reflect actual keyword density and formatting of THIS document

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "atsScore": <number 0-100>,
  "scoreBreakdown": {
    "formatting": <number 0-100>,
    "keywords": <number 0-100>,
    "experience": <number 0-100>,
    "skills": <number 0-100>,
    "education": <number 0-100>,
    "overall": <number 0-100>
  },
  "strengths": ["specific strength referencing actual resume content", ...],
  "weaknesses": ["specific weakness based on actual resume", ...],
  "missingSkills": ["skill not found in resume but needed", ...],
  "suggestions": ["specific actionable suggestion for this resume", ...],
  "sectionFeedback": {
    "summary": "feedback on this resume's summary section",
    "experience": "feedback on this resume's experience section",
    "skills": "feedback on this resume's skills section",
    "education": "feedback on this resume's education section",
    "formatting": "feedback on this resume's formatting"
  },
  "keywordsFound": ["keyword actually found in resume", ...],
  "keywordsMissing": ["important keyword NOT in resume", ...],
  "keywordDensity": <number 0-100>,
  "industryMatch": <number 0-100>
}
`;

  try {
    const aiResult = await callAI(prompt);

    if (!aiResult) {
      console.warn('⚠️ AI providers unavailable for resume analysis. Using fallback data.');
      return {
        ...getFallbackAnalysis(resumeExcerpt),
        aiModel: 'fallback',
        processingTime: Date.now() - startTime
      };
    }

    const parsed = parseAIJson(aiResult.text);
    if (!parsed || typeof parsed.atsScore !== 'number') {
      console.warn('⚠️ AI returned invalid format for resume analysis. Using fallback data.');
      return {
        ...getFallbackAnalysis(resumeExcerpt),
        aiModel: 'fallback',
        processingTime: Date.now() - startTime
      };
    }

    return {
      ...parsed,
      aiModel: aiResult.model,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    console.error('Resume analysis error:', error.message);
    throw error;
  }
};

// ========================
// 2. JOB RECOMMENDATIONS
// ========================
const getJobRecommendations = async (resumeData, count = 5) => {
  const skillsList = Array.isArray(resumeData.skills) ? resumeData.skills.join(', ') : '';
  const experienceText = resumeData.experience ? JSON.stringify(resumeData.experience).substring(0, 500) : '';

  const prompt = `
Based on this candidate profile, generate ${count} realistic job recommendations.

CANDIDATE PROFILE:
- Skills: ${skillsList}
- Experience: ${experienceText}
- Education: ${JSON.stringify(resumeData.education || []).substring(0, 300)}

Return ONLY valid JSON object with this structure:
{
  "jobs": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State or Remote",
      "type": "Full-time",
      "salary": "$80,000 - $100,000",
      "matchScore": 85,
      "requiredSkills": ["skill1", "skill2"],
      "description": "Brief job description (2 sentences)",
      "whyMatch": "Why this matches the candidate's profile",
      "industry": "Industry name",
      "experienceLevel": "Mid"
    }
  ]
}
`;

  try {
    const aiResult = await callAI(prompt);

    if (!aiResult) {
      console.warn('⚠️ AI providers unavailable for recommendations. Using fallback data.');
      return getFallbackJobs(resumeData.skills || []);
    }

    const parsed = parseAIJson(aiResult.text);
    
    // Handle both { jobs: [...] } wrapper and direct [...] array
    let jobs;
    if (Array.isArray(parsed)) {
      jobs = parsed;
    } else if (parsed && Array.isArray(parsed.jobs)) {
      jobs = parsed.jobs;
    } else {
      console.warn('⚠️ AI returned invalid format for recommendations. Using fallback data.');
      return getFallbackJobs(resumeData.skills || []);
    }

    return jobs;

  } catch (error) {
    console.error('Job recommendations error:', error.message);
    throw error;
  }
};


// ========================
// 3. INTERVIEW QUESTION GENERATOR
// ========================
const generateInterviewQuestions = async (jobTitle, skills = [], experienceLevel = 'mid', count = 10, interviewType = 'mixed') => {
  let formatInstruction = 'Mix: 40% technical, 30% behavioral, 20% situational, 10% cultural fit.\nMix formats: Generate approximately 30% "mcq" and 70% "open-ended" questions.';
  
  if (interviewType === 'mcq-only') {
    formatInstruction = 'CRITICAL: Format requirement: Generate 100% "mcq" questions. Do NOT generate open-ended questions.\nMix: 50% technical, 30% situational, 20% behavioral.';
  } else if (interviewType === 'technical') {
    formatInstruction = 'Focus: 80% technical, 20% behavioral.\nMix formats: 30% "mcq" and 70% "open-ended".';
  } else if (interviewType === 'behavioral') {
    formatInstruction = 'Focus: 100% behavioral/situational.\nMix formats: 20% "mcq" and 80% "open-ended".';
  } else if (interviewType === 'case-study') {
    formatInstruction = 'Focus: 100% case-study and complex scenario problem solving.\nFormat: 100% "open-ended".';
  }

  const prompt = `
CRITICAL INSTRUCTION: You MUST generate ${count} interview questions SPECIFICALLY for the exact job role: "${jobTitle}".
Do not generate generic questions. Every technical question must be directly related to a "${jobTitle}" position at a ${experienceLevel} level.

CANDIDATE'S BACKGROUND SKILLS: ${skills.join(', ')}
(Note: Use these background skills only if they align with the "${jobTitle}" role. If they are irrelevant to a "${jobTitle}", IGNORE the skills and focus 100% on the "${jobTitle}" role.)

Return ONLY valid JSON object (not array) with this structure:
{
  "questions": [
    {
      "question": "Detailed interview question here?",
      "format": "open-ended|mcq",
      "options": ["Option A", "Option B", "Option C", "Option D"], // If mcq, provide 4 options. If open-ended, leave empty []
      "type": "behavioral",
      "difficulty": "medium",
      "expectedAnswer": "Key points to look for in an ideal answer or the exact correct option if MCQ",
      "followUpQuestions": ["Follow-up 1?", "Follow-up 2?"]
    }
  ]
}

${formatInstruction}
Type must be one of: behavioral, technical, situational, cultural
Difficulty must be one of: easy, medium, hard
Include questions about: problem-solving, teamwork, specific technical skills, past experiences
`;

  try {
    const aiResult = await callAI(prompt);

    if (!aiResult) {
      console.warn('⚠️ AI providers unavailable for interview questions. Using fallback data.');
      return getFallbackQuestions(jobTitle);
    }

    const parsed = parseAIJson(aiResult.text);
    
    // Handle both { questions: [...] } wrapper and direct [...] array
    let questions;
    if (Array.isArray(parsed)) {
      questions = parsed;
    } else if (parsed && Array.isArray(parsed.questions)) {
      questions = parsed.questions;
    } else {
      console.warn('⚠️ AI returned invalid format for interview questions. Using fallback data.');
      return getFallbackQuestions(jobTitle);
    }

    return questions;

  } catch (error) {
    console.error('Interview questions error:', error.message);
    throw error;
  }
};


// ========================
// 4. INTERVIEW ANSWER EVALUATOR
// ========================
const evaluateInterviewAnswer = async (question, answer, jobTitle = '', expectedAnswer = '', questionFormat = 'open-ended') => {
  if (questionFormat !== 'mcq' && (!answer || answer.trim().length < 20)) {
    return {
      score: 0,
      feedback: 'Answer too short. Please provide a detailed response.',
      strengths: [],
      improvements: ['Provide a complete, detailed answer', 'Use specific examples'],
      modelAnswer: expectedAnswer || 'Please provide a thoughtful, detailed answer with specific examples.',
      aiModel: 'mock'
    };
  }

  let prompt = '';
  
  if (questionFormat === 'mcq') {
    prompt = `
You are evaluating a Multiple Choice Question (MCQ).
QUESTION: ${question}
EXPECTED CORRECT ANSWER: ${expectedAnswer}
USER SELECTED OPTION: ${answer}

Evaluate this MCQ. If the user's selected option matches or strongly implies the expected correct answer, give a score of 10. Otherwise, give a score of 0.
Return ONLY valid JSON:
{
  "score": <number 0 or 10>,
  "feedback": "Explain why it is correct or incorrect briefly.",
  "strengths": [],
  "improvements": [],
  "modelAnswer": "The correct option is: ${expectedAnswer}"
}
`;
  } else {
    prompt = `
You are an experienced hiring manager evaluating an interview response.

QUESTION: ${question}
CANDIDATE'S ANSWER: ${answer}
${expectedAnswer ? `EXPECTED ANSWER OUTLINE: ${expectedAnswer}` : ''}
${jobTitle ? `ROLE: ${jobTitle}` : ''}

Evaluate this answer and return ONLY valid JSON:
{
  "score": <number 0-10>,
  "feedback": "Overall assessment in 2-3 sentences",
  "strengths": ["what they did well 1", "what they did well 2"],
  "improvements": ["what to improve 1", "what to improve 2"],
  "modelAnswer": "A strong model answer for this question"
}
`;
  }

  try {
    const aiResult = await callAI(prompt);

    if (!aiResult) {
      throw new Error('AI providers are currently unavailable for Answer Evaluation.');
    }

    const parsed = parseAIJson(aiResult.text);
    if (!parsed || parsed.score === undefined) {
      throw new Error('AI returned an invalid response format for Answer Evaluation.');
    }

    return { ...parsed, aiModel: aiResult.model };

  } catch (error) {
    console.error('Answer evaluation error:', error.message);
    throw error;
  }
};


// ========================
// 5. AI RESUME SCREENING
// ========================
const screenResume = async (resumeText, jobTitle, jobDescription, requiredSkills = []) => {
  const prompt = `
You are an expert HR recruiter and ATS specialist performing resume screening.

RESUME TEXT:
${resumeText.substring(0, 3000)}

JOB TITLE: ${jobTitle}
JOB DESCRIPTION:
${jobDescription.substring(0, 1500)}
${requiredSkills.length > 0 ? `REQUIRED SKILLS: ${requiredSkills.join(', ')}` : ''}

Screen this resume against the job requirements and return ONLY valid JSON:
{
  "verdict": "shortlisted|maybe|rejected",
  "matchScore": <number 0-100>,
  "summary": "2-3 sentence executive summary of the candidate's fit",
  "matchedRequirements": [
    { "requirement": "requirement text", "status": "met|partial|unmet", "evidence": "evidence from resume" }
  ],
  "strengths": ["strength1", "strength2", "strength3"],
  "redFlags": ["concern1", "concern2"],
  "experienceMatch": {
    "requiredYears": <number>,
    "estimatedYears": <number>,
    "relevanceScore": <number 0-100>
  },
  "skillsAnalysis": {
    "matched": ["skill1", "skill2"],
    "missing": ["skill1", "skill2"],
    "bonus": ["extra skill1"]
  },
  "cultureFitIndicators": ["indicator1", "indicator2"],
  "recommendation": "Detailed hiring recommendation in 2-3 sentences",
  "interviewFocus": ["area to probe in interview 1", "area 2"]
}
`;

  try {
    const aiResult = await callAI(prompt);
    if (!aiResult) {
      console.warn('⚠️ AI providers unavailable for resume screening. Using fallback data.');
      return { ...getFallbackScreening(jobTitle), aiModel: 'fallback' };
    }

    const parsed = parseAIJson(aiResult.text);
    if (!parsed || !parsed.verdict) {
      console.warn('⚠️ AI returned invalid format for resume screening. Using fallback data.');
      return { ...getFallbackScreening(jobTitle), aiModel: 'fallback' };
    }

    return { ...parsed, aiModel: aiResult.model };
  } catch (error) {
    console.error('Resume screening error:', error.message);
    throw error;
  }
};


// ========================
// 6. SKILL GAP ANALYZER
// ========================
const analyzeSkillGap = async (resumeText, currentSkills = [], targetRole, experienceLevel = 'mid') => {
  const prompt = `
You are a career development expert and skills analyst.

RESUME TEXT:
${resumeText.substring(0, 3000)}

CURRENT SKILLS: ${currentSkills.join(', ')}
TARGET ROLE: ${targetRole}
EXPERIENCE LEVEL: ${experienceLevel}

Analyze the skill gaps between this candidate's current profile and the target role.
Return ONLY valid JSON:
{
  "overallReadiness": <number 0-100>,
  "readinessLevel": "ready|almost_ready|developing|significant_gaps",
  "summary": "2-3 sentence overview of readiness for the target role",
  "skillCategories": [
    {
      "category": "Category Name (e.g., Technical Skills, Soft Skills, Tools)",
      "currentLevel": <number 0-100>,
      "requiredLevel": <number 0-100>,
      "gap": <number, can be negative if exceeds>,
      "skills": [
        { "name": "Skill Name", "current": <0-100>, "required": <0-100>, "priority": "critical|important|nice_to_have", "status": "strong|adequate|weak|missing" }
      ]
    }
  ],
  "learningPath": [
    { "step": 1, "skill": "Skill to learn", "resource": "Recommended resource or course", "timeEstimate": "2-4 weeks", "priority": "critical|important|nice_to_have" }
  ],
  "strengthsToLeverage": ["existing strength 1", "existing strength 2"],
  "criticalGaps": ["critical missing skill 1", "critical missing skill 2"],
  "marketInsights": {
    "demandLevel": "high|medium|low",
    "salaryRange": "$X - $Y",
    "growthOutlook": "Positive outlook description",
    "topEmployers": ["Company 1", "Company 2"]
  },
  "timeToReady": "Estimated months to fill gaps",
  "certifications": [
    { "name": "Certification Name", "provider": "Provider", "importance": "critical|recommended|optional" }
  ]
}
`;

  try {
    const aiResult = await callAI(prompt);
    if (!aiResult) {
      console.warn('⚠️ AI providers unavailable for skill gap analysis. Using fallback data.');
      return { ...getFallbackSkillGap(targetRole), aiModel: 'fallback' };
    }

    const parsed = parseAIJson(aiResult.text);
    if (!parsed || !parsed.overallReadiness) {
      console.warn('⚠️ AI returned invalid format for skill gap analysis. Using fallback data.');
      return { ...getFallbackSkillGap(targetRole), aiModel: 'fallback' };
    }

    return { ...parsed, aiModel: aiResult.model };
  } catch (error) {
    console.error('Skill gap analysis error:', error.message);
    throw error;
  }
};


module.exports = {
  analyzeResume,
  getJobRecommendations,
  generateInterviewQuestions,
  evaluateInterviewAnswer,
  screenResume,
  analyzeSkillGap
};
