export type FieldType = "text" | "tel" | "email" | "dropdown" | "toggle" | "textarea" | "photo";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  hint?: string;
}

export interface FormSchemaDef {
  essential: FieldDef[];
  important: FieldDef[];
  advanced: FieldDef[];
}

export const FORM_SCHEMA: Record<string, FormSchemaDef> = {
  vehicle: {
    essential: [
      { key: "vehicle_type", label: "Vehicle Type", type: "dropdown", options: ["Car", "Bike", "Scooter", "Auto Rickshaw", "Truck", "Bus", "Other"], required: true },
      { key: "vehicle_number", label: "Vehicle Number", type: "text", placeholder: "MH01AB1234", required: true },
      { key: "vehicle_name", label: "Vehicle Name / Model", type: "text", placeholder: "e.g. Honda City, Royal Enfield", required: true },
      { key: "primary_phone", label: "Owner's Phone", type: "tel", placeholder: "+91 98765 43210", required: true },
    ],
    important: [
      { key: "color", label: "Vehicle Colour", type: "text", placeholder: "e.g. White, Silver" },
      { key: "emergency_contact_1", label: "Emergency Contact 1", type: "tel", placeholder: "+91 98765 43210" },
      { key: "emergency_contact_2", label: "Emergency Contact 2", type: "tel", placeholder: "+91 98765 43210" },
    ],
    advanced: [
      { key: "blood_group", label: "Owner's Blood Group", type: "dropdown", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"] },
      { key: "health_insurance", label: "Health Insurance Provider", type: "text", placeholder: "e.g. Star Health, HDFC Ergo" },
      { key: "notes", label: "Additional Notes", type: "textarea", placeholder: "Any special instructions for the finder..." },
    ],
  },

  pet: {
    essential: [
      { key: "pet_name", label: "Pet Name", type: "text", placeholder: "e.g. Bruno, Whiskers", required: true },
      { key: "photo", label: "Pet Photo", type: "photo" },
      { key: "owner_phone", label: "Owner's Phone", type: "tel", placeholder: "+91 98765 43210", required: true },
    ],
    important: [
      { key: "breed", label: "Breed", type: "text", placeholder: "e.g. Labrador, Persian" },
      { key: "color", label: "Fur Colour / Markings", type: "text", placeholder: "e.g. Golden, Black & White" },
      { key: "gender", label: "Gender", type: "dropdown", options: ["Male", "Female", "Unknown"] },
      { key: "vaccinated", label: "Vaccinated", type: "toggle", hint: "Toggle on if your pet is vaccinated" },
    ],
    advanced: [
      { key: "owner_name", label: "Owner Name", type: "text", placeholder: "Full name" },
      { key: "address", label: "Home Address", type: "textarea", placeholder: "Street, city, landmark..." },
      { key: "medical_notes", label: "Medical Notes", type: "textarea", placeholder: "Allergies, conditions, medications..." },
      { key: "special_instructions", label: "Special Instructions", type: "textarea", placeholder: "Diet, behaviour, handling notes..." },
    ],
  },

  child: {
    essential: [
      { key: "child_name", label: "Child's Name", type: "text", placeholder: "Full name", required: true },
      { key: "photo", label: "Child's Photo", type: "photo" },
      { key: "parent_phone", label: "Parent's Phone", type: "tel", placeholder: "+91 98765 43210", required: true },
    ],
    important: [
      { key: "backup_contact", label: "Backup Contact", type: "tel", placeholder: "Alternate guardian number" },
      { key: "school_name", label: "School Name", type: "text", placeholder: "e.g. DPS, St. Xavier's" },
      { key: "age", label: "Age", type: "text", placeholder: "e.g. 8 years" },
    ],
    advanced: [
      { key: "address", label: "Home Address", type: "textarea", placeholder: "Street, city, landmark..." },
      { key: "medical_notes", label: "Medical / Allergy Notes", type: "textarea", placeholder: "Any conditions or allergies..." },
      { key: "instructions", label: "Instructions for Finder", type: "textarea", placeholder: "What should the finder do if they find this child?" },
    ],
  },

  medical: {
    essential: [
      { key: "name", label: "Patient Name", type: "text", placeholder: "Full name", required: true },
      { key: "emergency_contact", label: "Emergency Contact", type: "tel", placeholder: "+91 98765 43210", required: true },
    ],
    important: [
      { key: "blood_group", label: "Blood Group", type: "dropdown", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"] },
      { key: "conditions", label: "Medical Conditions", type: "textarea", placeholder: "e.g. Diabetes, Hypertension, Epilepsy..." },
      { key: "allergies", label: "Allergies", type: "textarea", placeholder: "e.g. Penicillin, Nuts, Dust..." },
    ],
    advanced: [
      { key: "medications", label: "Current Medications", type: "textarea", placeholder: "List of medicines with dosage..." },
      { key: "doctor_contact", label: "Doctor's Contact", type: "tel", placeholder: "Doctor's phone number" },
      { key: "insurance_details", label: "Insurance Details", type: "text", placeholder: "Provider + policy number" },
    ],
  },

  home: {
    essential: [
      { key: "house_name", label: "House / Property Name", type: "text", placeholder: "e.g. Sunrise Villa, Flat 4B", required: true },
      { key: "contact_number", label: "Contact Number", type: "tel", placeholder: "+91 98765 43210", required: true },
    ],
    important: [
      { key: "instructions", label: "Visitor Instructions", type: "textarea", placeholder: "Gate code, bell, parking, etc." },
    ],
    advanced: [
      { key: "alternate_contact", label: "Alternate Contact", type: "tel", placeholder: "Backup number" },
      { key: "availability_notes", label: "Availability Notes", type: "textarea", placeholder: "Best time to visit, delivery instructions..." },
    ],
  },

  belongings: {
    essential: [
      { key: "item_name", label: "Item Name / Description", type: "text", placeholder: "e.g. Blue Backpack, MacBook Pro", required: true },
      { key: "contact_number", label: "Owner's Phone", type: "tel", placeholder: "+91 98765 43210", required: true },
    ],
    important: [
      { key: "reward_note", label: "Reward Note", type: "text", placeholder: "e.g. Reward if found — please call!" },
      { key: "color_description", label: "Colour / Description", type: "text", placeholder: "e.g. Black, serial no. 12345" },
    ],
    advanced: [
      { key: "alternate_contact", label: "Alternate Contact", type: "tel", placeholder: "Backup number" },
      { key: "instructions", label: "Finder Instructions", type: "textarea", placeholder: "Drop at nearest police station, WhatsApp only, etc." },
    ],
  },

  luggage: {
    essential: [
      { key: "bag_name", label: "Bag / Case Name", type: "text", placeholder: "e.g. Blue Trolley, Camera Bag", required: true },
      { key: "contact_number", label: "Owner's Phone", type: "tel", placeholder: "+91 98765 43210", required: true },
    ],
    important: [
      { key: "destination", label: "Destination", type: "text", placeholder: "e.g. Mumbai, London" },
      { key: "travel_date", label: "Travel Date", type: "text", placeholder: "DD/MM/YYYY" },
    ],
    advanced: [
      { key: "notes", label: "Notes", type: "textarea", placeholder: "Flight number, airline, PNR..." },
      { key: "reward_message", label: "Reward Message", type: "text", placeholder: "e.g. ₹500 reward if returned" },
    ],
  },

  wallet: {
    essential: [
      { key: "item_name", label: "Item Name", type: "text", placeholder: "e.g. Black Wallet, Car Keys", required: true },
      { key: "contact_number", label: "Contact Number", type: "tel", placeholder: "+91 98765 43210", required: true },
    ],
    important: [
      { key: "reward_note", label: "Reward Note", type: "text", placeholder: "e.g. Will reward generously!" },
    ],
    advanced: [
      { key: "alternate_contact", label: "Alternate Contact", type: "tel", placeholder: "Backup number" },
      { key: "instructions", label: "Finder Instructions", type: "textarea", placeholder: "Nearest police station, drop location..." },
    ],
  },

  event: {
    essential: [
      { key: "event_name", label: "Event Name", type: "text", placeholder: "e.g. Arya & Priya Wedding 2026", required: true },
    ],
    important: [
      { key: "message", label: "Personal Message", type: "textarea", placeholder: "A message for whoever scans this..." },
      { key: "link", label: "Event Link / Album URL", type: "text", placeholder: "https://photos.google.com/..." },
    ],
    advanced: [
      { key: "contact_info", label: "Contact Info", type: "tel", placeholder: "Organiser's number" },
    ],
  },

  business: {
    essential: [
      { key: "name", label: "Full Name", type: "text", placeholder: "Your name", required: true },
      { key: "phone", label: "Phone Number", type: "tel", placeholder: "+91 98765 43210", required: true },
    ],
    important: [
      { key: "company", label: "Company / Designation", type: "text", placeholder: "e.g. CEO, Stegofy Technologies" },
      { key: "email", label: "Email Address", type: "email", placeholder: "you@company.com" },
    ],
    advanced: [
      { key: "website", label: "Website", type: "text", placeholder: "https://yoursite.com" },
      { key: "social_links", label: "Social / LinkedIn URL", type: "text", placeholder: "LinkedIn, Instagram, etc." },
      { key: "address", label: "Office Address", type: "textarea", placeholder: "Office address..." },
    ],
  },
};

export function getFormLabel(type: string): string {
  const labels: Record<string, string> = {
    vehicle: "Vehicle Details",
    pet: "Pet Details",
    child: "Child Details",
    medical: "Medical Info",
    home: "Property Details",
    belongings: "Item Details",
    luggage: "Luggage Details",
    wallet: "Item Details",
    event: "Event Details",
    business: "Business Card",
  };
  return labels[type] ?? "Details";
}

export function getNameKey(type: string): string {
  const keys: Record<string, string> = {
    vehicle: "vehicle_name",
    pet: "pet_name",
    child: "child_name",
    medical: "name",
    home: "house_name",
    belongings: "item_name",
    luggage: "bag_name",
    wallet: "item_name",
    event: "event_name",
    business: "name",
  };
  return keys[type] ?? "name";
}
