// Supabase configuration - 안전한 환경변수 접근
const getEnvVar = (key: string, fallback: string) => {
    try {
      return (import.meta?.env?.[key] as string) || fallback;
    } catch {
      return fallback;
    }
  };
  
  export const projectId = "nbizzgetxskphtltxnva"
  export const publicAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iaXp6Z2V0eHNrcGh0bHR4bnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMDMyODYsImV4cCI6MjA3NDg3OTI4Nn0.1gczm8kqvldopwUYX6NkY-XZ9cEUn4sw5ueSuZg88D0")