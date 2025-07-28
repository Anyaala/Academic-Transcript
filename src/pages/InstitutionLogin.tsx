import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Building, Lock, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { validateEmail, validatePassword, sanitizeInput, logSecurityEvent } from "@/utils/security";
import { useToast } from "@/hooks/use-toast";


const InstitutionLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect logged-in users to their correct dashboard
  useEffect(() => {
    console.log('InstitutionLogin: useEffect triggered, user:', user?.id, 'loading:', loading);
    
    const checkUserAndRedirect = async () => {
      if (user) {
        console.log('InstitutionLogin: User found, checking type...', user.id);
        console.log('InstitutionLogin: User metadata:', user.user_metadata);
        
        try {
          // Add a small delay to ensure auth state is stable
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Check which type of user this is
          const [institutionResult, studentResult] = await Promise.all([
            supabase
              .from('institutions')
              .select('id, name, email')
              .eq('user_id', user.id)
              .maybeSingle(),
            supabase
              .from('students')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle()
          ]);

          console.log('InstitutionLogin: Database check results:', {
            institution: institutionResult.data,
            student: studentResult.data,
            institutionError: institutionResult.error,
            studentError: studentResult.error
          });

          if (institutionResult.data) {
            console.log('InstitutionLogin: Redirecting to institution dashboard');
            setTimeout(() => {
              navigate("/institution/dashboard");
            }, 100);
          } else if (studentResult.data) {
            console.log('InstitutionLogin: User is student, redirecting to student dashboard');
            setTimeout(() => {
              navigate("/student/dashboard");
            }, 100);
          } else {
            console.log('InstitutionLogin: No profile found for user - may need to wait for trigger');
            
            // Try to create institution profile manually if it doesn't exist
            // Check if this looks like an institution based on metadata or context
            const looksLikeInstitution = user.user_metadata?.user_type === 'institution' || 
                                       user.user_metadata?.name || 
                                       window.location.pathname.includes('/institution/');
            
            console.log('InstitutionLogin: Checking if looks like institution:', {
              userType: user.user_metadata?.user_type,
              hasName: !!user.user_metadata?.name,
              isInstitutionPath: window.location.pathname.includes('/institution/'),
              looksLikeInstitution
            });
            
            if (looksLikeInstitution) {
              console.log('InstitutionLogin: Attempting to create institution profile manually');
              try {
                const { data: createResult, error: createError } = await supabase
                  .from('institutions')
                  .insert({
                    user_id: user.id,
                    name: user.user_metadata?.name || 'Unnamed Institution',
                    email: user.email
                  })
                  .select()
                  .single();
                
                if (createError) {
                  console.error('InstitutionLogin: Error creating institution profile:', createError);
                } else {
                  console.log('InstitutionLogin: Successfully created institution profile:', createResult);
                  setTimeout(() => {
                    navigate("/institution/dashboard");
                  }, 100);
                  return;
                }
              } catch (manualCreateError) {
                console.error('InstitutionLogin: Manual profile creation failed:', manualCreateError);
              }
            }
            
            // Wait a bit and try again in case the trigger is still running
            setTimeout(checkUserAndRedirect, 1000);
          }
        } catch (error) {
          console.error('InstitutionLogin: Error checking user type:', error);
        }
      } else {
        console.log('InstitutionLogin: No user found');
      }
    };

    // Only run if not loading
    if (!loading) {
      checkUserAndRedirect();
    }
  }, [user, navigate, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Enhanced input validation
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedName = sanitizeInput(name);
    
    const emailValidation = validateEmail(sanitizedEmail);
    if (!emailValidation.isValid) {
      toast({
        title: "Invalid Email",
        description: emailValidation.error,
        variant: "destructive",
      });
      await logSecurityEvent({
        action: 'institution_login_invalid_email',
        details: { error: emailValidation.error },
        severity: 'low'
      });
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        toast({
          title: "Password Requirements",
          description: passwordValidation.error,
          variant: "destructive",
        });
        await logSecurityEvent({
          action: 'institution_signup_weak_password',
          details: { error: passwordValidation.error },
          severity: 'medium'
        });
        setLoading(false);
        return;
      }
      
      console.log('Signing up institution with name:', sanitizedName);
      const result = await signUp(sanitizedEmail, password, 'institution', { name: sanitizedName });
      console.log('SignUp result:', result);
    } else {
      const { error } = await signIn(sanitizedEmail, password);
      if (!error) {
        await logSecurityEvent({
          action: 'institution_login_successful',
          details: { email: sanitizedEmail },
          severity: 'low'
        });
        // Don't manually navigate - let the useEffect handle redirection
      } else {
        await logSecurityEvent({
          action: 'institution_login_failed',
          details: { error: error.message },
          severity: 'medium'
        });
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
              <Building className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Institution Portal</h1>
          <p className="text-white/80">Secure transcript verification system</p>
        </div>

        <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-strong">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {isSignUp ? "Create Institution Account" : "Sign In to Your Institution"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground">Institution Name</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="University of Example"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Institution Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={isSignUp ? "Create a strong password" : "Enter your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={isSignUp ? 8 : undefined}
                  />
                </div>
                {isSignUp && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Password must be at least 8 characters with uppercase, lowercase, and number
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? "Please wait..." : (isSignUp ? "Create Account" : "Sign In")}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground space-y-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:underline"
              >
                {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
              </button>
              

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
};

export default InstitutionLogin;