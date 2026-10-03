/**
 * Rule-Based Career Skill Gap Guidance Service
 * Transparent rule-based system that compares current student skills against target career profiles.
 * Note: Purely advisory/curricular guidance, not a prediction of career outcomes.
 */

const DOMAIN_CURRICULA = {
  'Web Development': {
    coreSkills: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'Express.js', 'MongoDB', 'Git', 'REST APIs'],
    certifications: ['Meta Full Stack Developer Certificate', 'freeCodeCamp Full Stack Certification', 'AWS Certified Cloud Practitioner'],
    projects: ['MERN / Full-Stack CRUD Application with Authentication', 'Real-time collaborative tool (e.g. Chat or Kanban board)'],
    trainingModules: ['Asynchronous JavaScript & Event Loop', 'RESTful API Design & MongoDB Indexing', 'Full-stack Deployment & CI/CD'],
  },
  'App Development': {
    coreSkills: ['Flutter', 'Dart', 'React Native', 'Kotlin', 'Mobile UI/UX', 'REST APIs', 'Firebase', 'State Management'],
    certifications: ['Google Associate Android Developer', 'Meta React Native Specialization'],
    projects: ['Offline-first Expense Tracker with Local SQLite/Room DB', 'Campus Event Navigator Mobile App'],
    trainingModules: ['Mobile State Management (Bloc/Redux/Provider)', 'Mobile App Performance & Lifecycle'],
  },
  'Data Science': {
    coreSkills: ['Python', 'SQL', 'NumPy', 'Pandas', 'Scikit-Learn', 'Data Visualization', 'Statistics', 'EDA'],
    certifications: ['IBM Data Science Professional Certificate', 'Google Data Analytics Certificate', 'Coursera Applied Data Science with Python'],
    projects: ['Exploratory Data Analysis with Interactive Dashboard', 'Predictive Modeling on Real-World Open Datasets'],
    trainingModules: ['Advanced Statistical Inference & Probability', 'Feature Engineering & Cross-Validation'],
  },
  'AI/ML': {
    coreSkills: ['Python', 'Linear Algebra', 'Calculus', 'Scikit-Learn', 'TensorFlow', 'PyTorch', 'Model Evaluation', 'NLP / Computer Vision'],
    certifications: ['DeepLearning.AI Deep Learning Specialization', 'TensorFlow Developer Certificate'],
    projects: ['End-to-End Image Classification or Sentiment Analysis Pipeline', 'Fine-tuned Transformer Model for Domain QA'],
    trainingModules: ['Neural Network Architectures & Optimization', 'MLOps & Model Serving'],
  },
  'Cyber Security': {
    coreSkills: ['Networking Basics (TCP/IP)', 'Linux Administration', 'OWASP Top 10', 'Wireshark', 'Cryptography', 'Vulnerability Assessment'],
    certifications: ['CompTIA Security+', 'Certified Ethical Hacker (CEH)', 'Cisco Certified CyberOps Associate'],
    projects: ['Network Packet Sniffer & Anomaly Detector', 'Vulnerability Assessment Audit Report for Sample App'],
    trainingModules: ['Web Application Penetration Testing', 'Network Security Defense Strategies'],
  },
  'Cloud Computing': {
    coreSkills: ['Linux', 'Networking', 'AWS / Azure / GCP', 'Docker', 'Kubernetes', 'CI/CD Pipelines', 'Infrastructure as Code'],
    certifications: ['AWS Certified Solutions Architect - Associate', 'Microsoft Certified: Azure Fundamentals', 'Docker Certified Associate'],
    projects: ['Containerized Microservices Cluster on Kubernetes', 'Automated CI/CD Pipeline with GitHub Actions'],
    trainingModules: ['Cloud Architecture Patterns', 'Container Orchestration & Monitoring'],
  },
  'Software Development': {
    coreSkills: ['Data Structures', 'Algorithms', 'Java / C++', 'Object-Oriented Design', 'SQL', 'Git', 'System Design'],
    certifications: ['Oracle Certified Professional: Java SE Programmer', 'HackerRank Problem Solving Gold Badge'],
    projects: ['High-throughput In-Memory Key-Value Store', 'Concurrent File Processing Utility'],
    trainingModules: ['Algorithmic Complexity & Dynamic Programming', 'Object-Oriented Design Patterns'],
  },
};

const HIGHER_STUDIES_CURRICULUM = {
  coreSkills: ['Academic Research', 'Research Paper Writing', 'LaTeX', 'Applied Mathematics', 'GRE / GATE Prep', 'English Proficiency'],
  certifications: ['Standardized Exam Certifications (GATE / GRE / IELTS / TOEFL)', 'Coursera Academic Research Methodology'],
  projects: ['Undergraduate Capstone Research Paper submitted to a peer-reviewed conference', 'Literature Survey on Emerging Computing Trends'],
  trainingModules: ['Statement of Purpose (SOP) & Research Proposal Drafting', 'Quantitative Reasoning & Analytical Writing Seminars'],
};

const ENTREPRENEURSHIP_CURRICULUM = {
  coreSkills: ['Lean Canvas Modeling', 'MVP Prototyping', 'Customer Discovery', 'Basic Financial Modeling', 'Pitch Deck Design', 'Intellectual Property (IP) Basics'],
  certifications: ['Y Combinator Startup School Certificate', 'Entrepreneurship Specialization (Wharton / Coursera)'],
  projects: ['Functional Minimum Viable Product (MVP) tested with 20+ beta users', 'Validated Business Model Canvas with Unit Economics'],
  trainingModules: ['Early Stage Bootstrapping & Angel Pitching', 'Product-Market Fit & Customer Interview Techniques'],
};

const analyzeSkillGap = (student) => {
  if (!student) return null;

  const currentLanguages = (student.technicalProfile && student.technicalProfile.programmingLanguages) || [];
  const currentSkills = (student.technicalProfile && student.technicalProfile.technicalSkills) || [];
  const allStudentSkills = [...currentLanguages, ...currentSkills].map((s) => s.trim().toLowerCase());

  const goal = (student.careerGoal && student.careerGoal.primaryGoal) || 'Placement';
  let targetDomain = (student.careerGoal && student.careerGoal.placement && student.careerGoal.placement.preferredDomain) ||
    (student.technicalProfile && student.technicalProfile.preferredDomain) ||
    'Web Development';

  let curriculum;

  if (goal === 'Placement') {
    // Find matched domain curriculum or fallback to Web Development
    const matchedKey = Object.keys(DOMAIN_CURRICULA).find(
      (k) => k.toLowerCase() === targetDomain.toLowerCase()
    );
    curriculum = matchedKey ? DOMAIN_CURRICULA[matchedKey] : DOMAIN_CURRICULA['Web Development'];
  } else if (goal === 'Higher Studies') {
    curriculum = HIGHER_STUDIES_CURRICULUM;
    targetDomain = 'Higher Academic Studies';
  } else if (goal === 'Entrepreneurship') {
    curriculum = ENTREPRENEURSHIP_CURRICULUM;
    targetDomain = 'Startup & Innovation';
  }

  // Calculate acquired vs gap
  const acquired = [];
  const toDevelop = [];

  curriculum.coreSkills.forEach((skill) => {
    const isAcquired = allStudentSkills.some(
      (s) => s === skill.toLowerCase() || s.includes(skill.toLowerCase()) || skill.toLowerCase().includes(s)
    );
    if (isAcquired) {
      acquired.push(skill);
    } else {
      toDevelop.push(skill);
    }
  });

  // Check soft skills
  const commLevel = (student.technicalProfile && student.technicalProfile.communicationLevel) || 'Intermediate';
  const aptLevel = (student.technicalProfile && student.technicalProfile.aptitudeLevel) || 'Intermediate';

  const softSkillRecommendations = [];
  if (commLevel === 'Beginner' || commLevel === 'Intermediate') {
    softSkillRecommendations.push('Participate in group discussions and technical presentation seminars to advance Communication to Advanced level.');
  }
  if (aptLevel === 'Beginner' || aptLevel === 'Intermediate') {
    softSkillRecommendations.push('Practice weekly quantitative aptitude and logical reasoning mock tests on platforms like IndiaBIX or GeeksforGeeks.');
  }

  return {
    careerGoal: goal,
    targetDomain,
    acquiredSkills: acquired,
    skillsToDevelop: toDevelop,
    suggestedCertifications: curriculum.certifications,
    suggestedProjects: curriculum.projects,
    suggestedTrainingModules: curriculum.trainingModules,
    softSkillRecommendations,
    guidanceDisclaimer:
      'This guidance is generated by a rule-based academic mentoring curriculum. It is intended for study planning and skill development, not as a prediction of employment or career outcomes.',
  };
};

module.exports = { analyzeSkillGap };
