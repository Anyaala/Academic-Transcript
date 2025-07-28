import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { GraduationCap, User, Lock, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { validateEmail, sanitizeInput, logSecurityEvent } from "@/utils/security";
import { useToast } from "@/hooks/use-toast";

const StudentLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Only redirect if user is authenticated - let ProtectedRoute handle the rest
  useEffect(() => {
    console.log('StudentLogin: useEffect triggered, user:', user?.id, 'authLoading:', authLoading);
    
    if (user && !authLoading) {
      console.log('StudentLogin: User found, redirecting to dashboard (ProtectedRoute will handle validation)');
      navigate("/student/dashboard");
    }
  }, [user, navigate, authLoading]);

  // Students can only login - signup is handled by institutions

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Enhanced input validation
    const sanitizedEmail = sanitizeInput(email);
    
    const emailValidation = validateEmail(sanitizedEmail);
    if (!emailValidation.isValid) {
      toast({
        title: "Invalid Email",
        description: emailValidation.error,
        variant: "destructive",
      });
      await logSecurityEvent({
        action: 'student_login_invalid_email',
        details: { error: emailValidation.error },
        severity: 'low'
      });
      setLoading(false);
      return;
    }

    if (isSignUp) {
      // Check if student record exists first using RPC function
      let existingStudent = null;
      let studentCheckError = null;

      try {
        // Try using the secure RPC function first
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('check_student_for_signup', { student_email: sanitizedEmail });
        
        if (!rpcError && rpcResult && rpcResult.length > 0) {
          existingStudent = rpcResult[0];
        } else if (rpcError) {
          console.log('RPC function failed, trying direct query:', rpcError);
          
          // Fallback to direct query
          const { data: directResult, error: directError } = await supabase
            .from('students')
            .select('*')
            .eq('email', sanitizedEmail)
            .single();
          
          existingStudent = directResult;
          studentCheckError = directError;
        }
      } catch (error) {
        console.error('Error checking student record:', error);
        studentCheckError = error;
      }

      if (studentCheckError || !existingStudent) {
        toast({
          title: "Account Not Found",
          description: "No student record found with this email. Please contact your institution to be registered first.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (existingStudent.user_id) {
        toast({
          title: "Account Already Exists",
          description: "An account already exists for this email. Please sign in instead.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Passwords do not match.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Create auth account for pre-registered student
      try {
        // Clear any existing auth state first
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.log('SignOut error (ignoring):', signOutError);
        }
        
        const signUpResult = await signUp(sanitizedEmail, password, 'student', {
          full_name: existingStudent.full_name,
          institution_id: existingStudent.institution_id
        });

        console.log('SignUp result:', signUpResult);

        if (signUpResult.error) {
          throw signUpResult.error;
        }

        // The database trigger should automatically link the student record
        // But let's add a small delay and verify it worked
        console.log('Waiting for database trigger to process...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        // Verify the linking worked
        const { data: verifyStudent, error: verifyError } = await supabase
          .from('students')
          .select('user_id')
          .eq('id', existingStudent.id)
          .single();
          
        console.log('Student linking verification:', { verifyStudent, verifyError });
        
        // If trigger didn't work, manually link as fallback
        if (verifyStudent && !verifyStudent.user_id && signUpResult.data?.user) {
          console.log('Trigger failed, manually linking student record using RPC...');
          
          // Try using the RPC function first
          const { data: linkResult, error: linkError } = await supabase
            .rpc('link_student_to_user', {
              p_student_email: sanitizedEmail,
              p_user_id: signUpResult.data.user.id
            });

          if (linkError || !linkResult) {
            console.error('RPC linking failed, trying direct update:', linkError);
            
            // Fallback to direct update
            const { error: updateError } = await supabase
              .from('students')
              .update({ user_id: signUpResult.data.user.id, updated_at: new Date().toISOString() })
              .eq('id', existingStudent.id);

            if (updateError) {
              console.error('Error manually linking student record:', updateError);
            } else {
              console.log('Student record manually linked successfully (direct update)');
            }
          } else {
            console.log('Student record linked successfully using RPC');
          }
        }

        await logSecurityEvent({
          action: 'student_signup_successful',
          details: { email: sanitizedEmail },
          severity: 'low'
        });

        toast({
          title: "Account Setup Complete",
          description: "Your account has been created successfully. You can now sign in.",
        });
      } catch (signUpError: any) {
        console.error('Student signup error:', signUpError);
        await logSecurityEvent({
          action: 'student_signup_failed',
          details: { error: signUpError?.message },
          severity: 'medium'
        });
        
        toast({
          title: "Account Setup Failed",
          description: signUpError?.message || "Failed to create account. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // Regular login
      const { error } = await signIn(sanitizedEmail, password);
      if (!error) {
        await logSecurityEvent({
          action: 'student_login_successful',
          details: { email: sanitizedEmail },
          severity: 'low'
        });
        // Don't manually navigate - let the useEffect handle redirection
      } else {
        await logSecurityEvent({
          action: 'student_login_failed',
          details: { error: error.message },
          severity: 'medium'
        });
      }
    }
    
    setLoading(false);
  };

  // Add error boundary
  try {
    return (
      <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Student Portal</h1>
          <p className="text-white/80">Sign in to access your verified academic transcripts</p>
        </div>

        <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-strong">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
            <User className="h-5 w-5 text-secondary" />
            {isSignUp ? "Complete Account Setup" : "Sign In to Your Account"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Student Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  {isSignUp ? "Create Password" : "Password"}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={isSignUp ? "Create a secure password" : "Enter your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={isSignUp ? 8 : undefined}
                  />
                </div>
                {isSignUp && (
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters long
                  </p>
                )}
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-gradient-secondary hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? "Please wait..." : (isSignUp ? "Complete Setup" : "Sign In")}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-secondary hover:underline"
              >
                {isSignUp 
                  ? "Already have an account? Sign in" 
                  : "First time? Complete account setup"
                }
              </button>
              {!isSignUp && (
                <p className="text-xs">
                  Account setup is only available if your institution has registered you first.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link to="/" className="text-white/80 hover:text-white text-sm underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error('StudentLogin component error:', error);
    return (
      <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
        <div className="text-white text-center">
          <h2>Something went wrong</h2>
          <p>Please refresh the page and try again.</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white text-black rounded">
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
};

export default StudentLogin;