import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import InstitutionLogin from "./pages/InstitutionLogin";
import InstitutionDashboard from "./pages/InstitutionDashboard";
import StudentLogin from "./pages/StudentLogin";
import StudentDashboard from "./pages/StudentDashboard";
import VerifyTranscript from "./pages/VerifyTranscript";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/institution/login" element={<InstitutionLogin />} />
            <Route path="/institution/dashboard" element={
              <ProtectedRoute userType="institution">
                <InstitutionDashboard />
              </ProtectedRoute>
            } />
            <Route path="/student/login" element={<StudentLogin />} />
            <Route path="/student/dashboard" element={
              <ProtectedRoute userType="student">
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/verify" element={<VerifyTranscript />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
