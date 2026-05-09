/**
 * Resume Parser Utility
 * Extracts structured data from PDF and DOCX resume files
 * Supports: name, email, phone, skills, experience, education
 */

const fs = require('fs');
const path = require('path');

// ========================
// Text Extraction Functions
// ========================

/**
 * Extract text from PDF using pdf-parse
 */
const extractFromPDF = async (filePath) => {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF extraction error:', error.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

/**
 * Extract text from DOCX using mammoth
 */
const extractFromDOCX = async (filePath) => {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  } catch (error) {
    console.error('DOCX extraction error:', error.message);
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
};

// ========================
// Regex Patterns for Parsing
// ========================
const PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  linkedin: /(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)([A-Za-z0-9_-]+)/gi,
  github: /(?:github\.com\/)([A-Za-z0-9_-]+)/gi,
  portfolio: /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z]{2,}){1,}\/[^\s]*)/gi,
  
  // Section headers
  sections: {
    summary: /(?:^|\n)\s*(?:SUMMARY|PROFILE|OBJECTIVE|ABOUT ME|PROFESSIONAL SUMMARY)[\s:]*\n/im,
    experience: /(?:^|\n)\s*(?:EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|PROFESSIONAL EXPERIENCE|WORK HISTORY)[\s:]*\n/im,
    education: /(?:^|\n)\s*(?:EDUCATION|ACADEMIC|QUALIFICATIONS|DEGREES?)[\s:]*\n/im,
    skills: /(?:^|\n)\s*(?:SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|TECHNOLOGIES|EXPERTISE)[\s:]*\n/im,
    certifications: /(?:^|\n)\s*(?:CERTIFICATIONS?|CERTIFICATES?|CREDENTIALS|LICENSES?)[\s:]*\n/im,
    projects: /(?:^|\n)\s*(?:PROJECTS?|PORTFOLIO|PERSONAL PROJECTS?)[\s:]*\n/im,
  },
  
  // Date patterns
  dateRange: /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|Present|Current)/gi,
  year: /\b(19|20)\d{2}\b/g,
};

// ========================
// Skill Keywords Database
// ========================
const SKILL_KEYWORDS = {
  programming: [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust',
    'swift', 'kotlin', 'php', 'scala', 'r', 'matlab', 'perl', 'shell', 'bash',
    'objective-c', 'dart', 'groovy', 'lua', 'elixir', 'clojure', 'haskell'
  ],
  frontend: [
    'react', 'vue', 'angular', 'svelte', 'nextjs', 'next.js', 'nuxt', 'gatsby',
    'html', 'css', 'sass', 'scss', 'less', 'tailwind', 'bootstrap', 'material-ui',
    'redux', 'mobx', 'webpack', 'vite', 'parcel', 'babel', 'jquery', 'graphql',
    'apollo', 'styled-components', 'emotion', 'framer-motion'
  ],
  backend: [
    'node.js', 'nodejs', 'express', 'fastapi', 'django', 'flask', 'spring',
    'rails', 'laravel', 'aspnet', 'asp.net', 'nestjs', 'koa', 'hapi',
    'graphql', 'rest', 'grpc', 'websocket', 'microservices', 'serverless'
  ],
  database: [
    'mongodb', 'mysql', 'postgresql', 'postgres', 'sqlite', 'redis', 'elasticsearch',
    'dynamodb', 'cassandra', 'neo4j', 'firebase', 'supabase', 'oracle', 'mssql',
    'mariadb', 'cockroachdb', 'prisma', 'sequelize', 'mongoose', 'typeorm'
  ],
  cloud: [
    'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'heroku', 'vercel',
    'netlify', 'digitalocean', 'cloudflare', 'lambda', 'ec2', 's3', 'rds', 'eks',
    'ecs', 'azure functions', 'cloud run'
  ],
  devops: [
    'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'github actions',
    'gitlab ci', 'circle ci', 'travis ci', 'helm', 'prometheus', 'grafana', 'elk',
    'nginx', 'apache', 'linux', 'unix', 'git', 'github', 'gitlab', 'bitbucket',
    'ci/cd', 'devops', 'agile', 'scrum', 'jira', 'confluence'
  ],
  mobile: [
    'react native', 'flutter', 'swift', 'swiftui', 'xcode', 'android studio',
    'kotlin', 'java android', 'ionic', 'cordova', 'capacitor', 'expo'
  ],
  aiml: [
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras', 'scikit-learn',
    'pandas', 'numpy', 'scipy', 'matplotlib', 'seaborn', 'nlp', 'computer vision',
    'openai', 'langchain', 'hugging face', 'llm', 'data science', 'data analysis',
    'tableau', 'power bi', 'spark', 'hadoop'
  ],
  soft: [
    'leadership', 'communication', 'teamwork', 'problem solving', 'critical thinking',
    'project management', 'time management', 'collaboration', 'mentoring', 'agile',
    'presentation', 'analytical', 'strategic', 'innovation'
  ]
};

// Flatten all skills
const ALL_SKILLS = Object.values(SKILL_KEYWORDS).flat();

// ========================
// Extract Contact Info
// ========================
const extractContactInfo = (text) => {
  const emails = text.match(PATTERNS.email) || [];
  const phones = text.match(PATTERNS.phone) || [];
  const linkedinMatch = text.match(/linkedin\.com\/in\/([A-Za-z0-9_-]+)/i);
  const githubMatch = text.match(/github\.com\/([A-Za-z0-9_-]+)/i);

  // Extract name (usually first 1-3 lines before contact info)
  const firstLines = text.split('\n').slice(0, 5).map(l => l.trim()).filter(Boolean);
  const name = firstLines[0] || '';

  return {
    name: cleanName(name),
    email: emails[0] || '',
    phone: phones[0] ? phones[0].replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : '',
    linkedin: linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : '',
    github: githubMatch ? `https://github.com/${githubMatch[1]}` : ''
  };
};

/**
 * Clean extracted name (remove obvious non-names)
 */
const cleanName = (name) => {
  // Remove common resume headers
  const headers = ['resume', 'curriculum vitae', 'cv', 'name:', 'profile'];
  const lower = name.toLowerCase();
  if (headers.some(h => lower.includes(h))) return '';
  if (name.includes('@')) return ''; // Looks like email
  if (/\d/.test(name)) return ''; // Has numbers, probably not a name
  return name.trim().replace(/[^a-zA-Z\s.-]/g, '').trim();
};

// ========================
// Extract Skills
// ========================
const extractSkills = (text) => {
  const lowerText = text.toLowerCase();
  const foundSkills = new Set();

  ALL_SKILLS.forEach(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      // Capitalize properly
      foundSkills.add(skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    }
  });

  return [...foundSkills].slice(0, 30); // Limit to 30 skills
};

// ========================
// Extract Experience
// ========================
const extractExperience = (text) => {
  const experiences = [];
  
  // Find experience section
  const sectionMatch = text.match(PATTERNS.sections.experience);
  if (!sectionMatch) return experiences;

  const sectionStart = sectionMatch.index;
  // Get text from experience section onwards (stop at next major section)
  let sectionText = text.substring(sectionStart + sectionMatch[0].length);
  
  // Stop at next section
  const nextSection = sectionText.match(PATTERNS.sections.education) ||
                      sectionText.match(PATTERNS.sections.skills) ||
                      sectionText.match(PATTERNS.sections.certifications);
  
  if (nextSection) {
    sectionText = sectionText.substring(0, nextSection.index);
  }

  // Parse individual experience entries (simplified)
  const lines = sectionText.split('\n').filter(l => l.trim().length > 0);
  
  let currentExp = null;
  const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|(?:19|20)\d{2}|Present|Current/gi;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect if line contains a date range (likely a job entry header)
    if (datePattern.test(trimmed)) {
      if (currentExp) experiences.push(currentExp);
      currentExp = {
        company: '',
        role: trimmed.replace(datePattern, '').trim(),
        duration: trimmed.match(datePattern)?.join(' - ') || '',
        description: '',
        startDate: '',
        endDate: ''
      };
    } else if (currentExp) {
      // Add to description
      if (!currentExp.company && trimmed.length < 100) {
        currentExp.company = trimmed;
      } else {
        currentExp.description += (currentExp.description ? ' ' : '') + trimmed;
      }
    }
  });

  if (currentExp) experiences.push(currentExp);
  return experiences.slice(0, 10); // Max 10 experiences
};

// ========================
// Extract Education
// ========================
const extractEducation = (text) => {
  const education = [];
  
  const sectionMatch = text.match(PATTERNS.sections.education);
  if (!sectionMatch) return education;

  const sectionStart = sectionMatch.index;
  let sectionText = text.substring(sectionStart + sectionMatch[0].length);

  // Stop at skills or certifications
  const nextSection = sectionText.match(PATTERNS.sections.skills) ||
                      sectionText.match(PATTERNS.sections.certifications) ||
                      sectionText.match(PATTERNS.sections.experience);
  
  if (nextSection) {
    sectionText = sectionText.substring(0, nextSection.index);
  }

  const lines = sectionText.split('\n').filter(l => l.trim());
  const degrees = ['bachelor', 'master', 'phd', 'doctorate', 'associate', 'diploma', 'b.s', 'b.a', 'm.s', 'm.a', 'mba', 'b.e', 'b.tech', 'm.tech', 'b.sc', 'm.sc'];
  
  let currentEdu = null;
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    const lowerLine = trimmed.toLowerCase();
    const isDegree = degrees.some(d => lowerLine.includes(d));
    const hasYear = /\b(19|20)\d{2}\b/.test(trimmed);
    
    if (isDegree || (hasYear && trimmed.length < 150)) {
      if (currentEdu) education.push(currentEdu);
      currentEdu = {
        institution: '',
        degree: trimmed,
        field: '',
        year: (trimmed.match(/\b(19|20)\d{2}\b/) || [''])[0],
        gpa: (trimmed.match(/(?:GPA|gpa|G\.P\.A)[:\s]+(\d+\.\d+)/)?.[1]) || ''
      };
    } else if (currentEdu && !currentEdu.institution) {
      currentEdu.institution = trimmed;
    }
  });
  
  if (currentEdu) education.push(currentEdu);
  return education.slice(0, 5);
};

// ========================
// Extract Summary
// ========================
const extractSummary = (text) => {
  const sectionMatch = text.match(PATTERNS.sections.summary);
  if (!sectionMatch) return '';

  const sectionStart = sectionMatch.index;
  let sectionText = text.substring(sectionStart + sectionMatch[0].length);
  
  // Get first 500 chars of summary section
  const nextSection = sectionText.match(PATTERNS.sections.experience) ||
                      sectionText.match(PATTERNS.sections.skills) ||
                      sectionText.match(PATTERNS.sections.education);
  
  if (nextSection) sectionText = sectionText.substring(0, nextSection.index);
  
  return sectionText.trim().substring(0, 600);
};

// ========================
// Main Parse Function
// ========================
const parseResume = async (filePath) => {
  const startTime = Date.now();
  const ext = path.extname(filePath).toLowerCase();

  let rawText = '';

  // Extract raw text based on file type
  try {
    if (ext === '.pdf') {
      rawText = await extractFromPDF(filePath);
    } else if (ext === '.docx' || ext === '.doc') {
      rawText = await extractFromDOCX(filePath);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  } catch (error) {
    throw new Error(`Text extraction failed: ${error.message}`);
  }

  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Could not extract sufficient text from resume. File may be image-based or corrupted.');
  }

  // Parse structured data
  const contact = extractContactInfo(rawText);
  const skills = extractSkills(rawText);
  const experience = extractExperience(rawText);
  const education = extractEducation(rawText);
  const summary = extractSummary(rawText);

  const processingTime = Date.now() - startTime;

  return {
    rawText,
    parsedData: {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      location: '',
      summary,
      skills,
      experience,
      education,
      certifications: [],
      languages: [],
      links: {
        linkedin: contact.linkedin,
        github: contact.github,
        portfolio: ''
      }
    },
    meta: {
      wordCount: rawText.split(/\s+/).length,
      characterCount: rawText.length,
      pageCount: null, // Could be extracted from PDF metadata
      processingTime,
      fileType: ext.replace('.', '').toUpperCase()
    }
  };
};

module.exports = {
  parseResume
};
