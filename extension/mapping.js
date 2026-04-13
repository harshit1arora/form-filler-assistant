/**
 * Field Mapping Engine
 * 
 * Heuristic matching: builds a signature string from field metadata
 * and matches against known CRM field keywords.
 * 
 * Includes a confidence score (high/medium/low) for each match.
 * Supports a learning system: domain-specific overrides from chrome.storage.
 */

/**
 * Detailed Field Rules with weighted keywords and exclusion lists to avoid false positives.
 */
const FIELD_RULES = [
  { 
    crmKey: "first_name", 
    keywords: [
      { word: "first_name", weight: 10 }, { word: "firstname", weight: 10 }, 
      { word: "first name", weight: 10 }, { word: "fname", weight: 8 }, 
      { word: "given_name", weight: 9 }, { word: "givenname", weight: 9 }
    ],
    exclude: ["last", "family", "surname"]
  },
  { 
    crmKey: "last_name",  
    keywords: [
      { word: "last_name", weight: 10 }, { word: "lastname", weight: 10 }, 
      { word: "last name", weight: 10 }, { word: "lname", weight: 8 }, 
      { word: "surname", weight: 10 }, { word: "family_name", weight: 9 }
    ],
    exclude: ["first", "given"]
  },
  { 
    crmKey: "name",       
    keywords: [
      { word: "full_name", weight: 10 }, { word: "fullname", weight: 10 }, 
      { word: "full name", weight: 10 }, { word: "your name", weight: 8 }, 
      { word: "contact_name", weight: 8 }, { word: "name", weight: 4 }
    ],
    exclude: ["first", "last", "user", "company", "file"]
  },
  { 
    crmKey: "email",      
    keywords: [
      { word: "email", weight: 10 }, { word: "e-mail", weight: 10 }, 
      { word: "mail", weight: 6 }, { word: "email_address", weight: 10 }
    ],
    exclude: ["cc", "bcc", "subject"]
  },
  { 
    crmKey: "phone",      
    keywords: [
      { word: "phone", weight: 10 }, { word: "tel", weight: 9 }, 
      { word: "telephone", weight: 10 }, { word: "mobile", weight: 9 }, 
      { word: "cell", weight: 8 }, { word: "phone_number", weight: 10 }
    ],
    exclude: ["fax"]
  },
  { 
    crmKey: "company",    
    keywords: [
      { word: "company", weight: 10 }, { word: "organization", weight: 10 }, 
      { word: "org", weight: 7 }, { word: "business", weight: 8 }, 
      { word: "company_name", weight: 10 }, { word: "employer", weight: 9 }
    ],
    exclude: ["email"]
  },
  { 
    crmKey: "job_title",  
    keywords: [
      { word: "job_title", weight: 10 }, { word: "jobtitle", weight: 10 }, 
      { word: "title", weight: 6 }, { word: "role", weight: 7 }, 
      { word: "position", weight: 7 }, { word: "job title", weight: 10 }
    ],
    exclude: ["mr", "mrs", "ms", "dr"]
  },
  { 
    crmKey: "address",    
    keywords: [
      { word: "address", weight: 10 }, { word: "street", weight: 10 }, 
      { word: "street_address", weight: 10 }, { word: "address1", weight: 10 }, 
      { word: "address_line_1", weight: 10 }, { word: "addr", weight: 8 }
    ],
    exclude: ["email", "ip"]
  },
  { crmKey: "city",       keywords: [{ word: "city", weight: 10 }, { word: "town", weight: 8 }, { word: "locality", weight: 7 }] },
  { crmKey: "state",      keywords: [{ word: "state", weight: 10 }, { word: "province", weight: 9 }, { word: "region", weight: 7 }] },
  { crmKey: "zip",        keywords: [{ word: "zip", weight: 10 }, { word: "zipcode", weight: 10 }, { word: "postal", weight: 9 }, { word: "postcode", weight: 9 }] },
  { crmKey: "country",    keywords: [{ word: "country", weight: 10 }, { word: "nation", weight: 8 }] },
  { crmKey: "website",    keywords: [{ word: "website", weight: 10 }, { word: "url", weight: 9 }, { word: "homepage", weight: 8 }, { word: "site", weight: 6 }] },
  { crmKey: "notes",      keywords: [{ word: "notes", weight: 10 }, { word: "comments", weight: 9 }, { word: "message", weight: 8 }, { word: "description", weight: 8 }] },
];

/**
 * Match a single field using a weighted scoring system.
 * Returns { crmKey, confidenceScore } or null.
 */
function matchField(field) {
  const scores = {};
  
  // Weights for different sources of metadata
  const SOURCE_WEIGHTS = {
    name: 1.0,
    label: 1.2,
    id: 0.8,
    placeholder: 0.9
  };

  const metadata = {
    name: (field.name || "").toLowerCase(),
    label: (field.label || "").toLowerCase(),
    id: (field.id || "").toLowerCase(),
    placeholder: (field.placeholder || "").toLowerCase()
  };

  for (const rule of FIELD_RULES) {
    let score = 0;
    
    // Check if any exclusion keywords are present in any of the metadata
    const allMetadataText = Object.values(metadata).join(" ");
    if (rule.exclude && rule.exclude.some(ex => allMetadataText.includes(ex))) {
      continue;
    }

    for (const kw of rule.keywords) {
      for (const [source, text] of Object.entries(metadata)) {
        if (!text) continue;
        
        if (text.includes(kw.word)) {
          // Boost score if it's an exact match (not just partial)
          const exactBoost = (text === kw.word) ? 1.5 : 1.0;
          score += (kw.weight * SOURCE_WEIGHTS[source] * exactBoost);
        }
      }
    }

    // Type-based fallback boost
    if (field.type === "email" && rule.crmKey === "email") score += 15;
    if (field.type === "tel" && rule.crmKey === "phone") score += 15;
    if (field.type === "url" && rule.crmKey === "website") score += 15;

    if (score > 0) {
      scores[rule.crmKey] = score;
    }
  }

  // Find the highest score
  let bestKey = null;
  let maxScore = 0;
  for (const [key, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestKey = key;
    }
  }

  if (!bestKey || maxScore < 5) return null;

  // Map numerical score to confidence levels
  let confidence = "low";
  if (maxScore > 20) confidence = "high";
  else if (maxScore > 10) confidence = "medium";

  return { crmKey: bestKey, confidence, score: maxScore };
}

/**
 * Map an array of detected fields to CRM keys.
 * Returns array of { field, crmKey, confidence }.
 */
function mapFields(fields) {
  return fields.map((field) => {
    const match = matchField(field);
    return {
      field,
      crmKey: match ? match.crmKey : null,
      confidence: match ? match.confidence : null,
    };
  });
}

/**
 * LLM mapping fallback (mock).
 * In production, this would call an LLM API to infer field→CRM mapping.
 */
async function llmMapFields(fields) {
  console.log("[Form Copilot] LLM mapping fallback invoked (mock). Fields:", fields.length);
  // Returns empty — the caller should treat this as "no additional mappings"
  return [];
}

// Export for content script (injected as IIFE, so we attach to window)
if (typeof window !== "undefined") {
  window.__FC_Mapping = { mapFields, matchField, llmMapFields };
}
