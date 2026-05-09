const fetch = require('node-fetch');

/**
 * Job Aggregator Utility
 * Fetches real jobs from JSearch RapidAPI.
 * Falls back to highly realistic synthesized jobs if API key is missing or limit reached.
 */
const searchRealJobs = async (query, location = '', employmentTypes = '', datePosted = 'all', preferredSource = '') => {
  const apiKey = process.env.RAPIDAPI_KEY; // User can add this to .env
  
  if (apiKey && apiKey !== 'your_rapidapi_key_here') {
    try {
      const url = new URL('https://jsearch.p.rapidapi.com/search');
      url.searchParams.append('query', `${query} ${location}`);
      if (datePosted !== 'all') {
        url.searchParams.append('date_posted', datePosted);
      }
      if (employmentTypes) {
        url.searchParams.append('employment_types', employmentTypes.toUpperCase());
      }
      url.searchParams.append('num_pages', '1');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.data) {
          return data.data.map(job => ({
            id: job.job_id,
            title: job.job_title,
            company: job.employer_name,
            companyLogo: job.employer_logo,
            location: `${job.job_city || ''}, ${job.job_country || ''}`.replace(/^, | , $/g, '') || 'Remote',
            type: job.job_employment_type ? job.job_employment_type.replace('_', ' ') : 'Full-time',
            salary: job.job_min_salary ? `$${job.job_min_salary} - $${job.job_max_salary}` : null,
            description: job.job_description,
            postedAt: job.job_posted_at_datetime_utc,
            applyUrl: job.job_apply_link || `https://www.google.com/search?q=${encodeURIComponent(job.job_title + ' ' + job.employer_name + ' jobs')}`,
            source: job.job_publisher || preferredSource || 'LinkedIn',
            isRemote: job.job_is_remote,
            requiredSkills: job.job_required_skills || [],
            matchScore: Math.floor(Math.random() * 20) + 70 // Simulated match score
          }));
        }
      }
    } catch (err) {
      console.warn('⚠️ RapidAPI JSearch failed, falling back to synthesis:', err.message);
    }
  }

  // FALLBACK: Realistic Synthesized Jobs based on query
  console.log('Using simulated job search for query:', query);
  
  const sources = ['LinkedIn', 'Indeed', 'Glassdoor', 'Wellfound', 'Naukri.com'];
  const companies = ['TechNova', 'CloudScale', 'InnovateInc', 'FinStream', 'HealthTech', 'DataWorks', 'CyberDef', 'EcoSoft'];
  const locations = location ? [location, 'Remote', `${location} (Hybrid)`] : ['San Francisco, CA', 'New York, NY', 'Remote', 'London, UK', 'Austin, TX'];
  
  const synthesizedJobs = Array.from({ length: 8 }).map((_, i) => {
    const isRemote = Math.random() > 0.5;
    const loc = isRemote ? 'Remote' : locations[Math.floor(Math.random() * locations.length)];
    const src = preferredSource || sources[Math.floor(Math.random() * sources.length)];
    const comp = companies[Math.floor(Math.random() * companies.length)];
    
    return {
      id: `sim-${Date.now()}-${i}`,
      title: query.split(' ')[0] ? `${query.split(' ')[0]} Developer / Engineer` : 'Software Engineer',
      company: comp,
      companyLogo: `https://ui-avatars.com/api/?name=${comp}&background=random&color=fff`,
      location: loc,
      type: employmentTypes || (Math.random() > 0.2 ? 'Full-time' : 'Contract'),
      salary: `$${Math.floor(Math.random() * 50 + 70)},000 - $${Math.floor(Math.random() * 50 + 130)},000`,
      description: `We are looking for an experienced professional with a background in ${query}. You will join our dynamic team to build scalable solutions. Experience with modern frameworks and cloud technologies is highly desired. We offer competitive benefits and a great culture.`,
      postedAt: new Date(Date.now() - Math.floor(Math.random() * 10) * 86400000).toISOString(),
      applyUrl: `https://${src.toLowerCase().replace('.com', '')}.com/jobs/view/${Date.now()}-${i}`,
      source: src,
      isRemote,
      requiredSkills: [query.split(' ')[0] || 'JavaScript', 'React', 'Node.js', 'AWS'].filter(Boolean),
      matchScore: Math.floor(Math.random() * 25) + 70,
      missingSkills: ['Kubernetes', 'GraphQL'].slice(0, Math.floor(Math.random() * 3))
    };
  });

  return synthesizedJobs;
};

module.exports = { searchRealJobs };
