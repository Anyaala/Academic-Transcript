import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBlockchainAuth } from '@/hooks/useBlockchainAuth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, userType: 'institution' | 'student', additionalData?: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { authenticateWithBlockchain, logAuditEvent, isBlockchainEnabled } = useBlockchainAuth();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Log authentication events to blockchain (non-blocking)
        if (session?.user) {
          const authEvent = {
            action: event === 'SIGNED_IN' ? 'login' as const : 
                   event === 'SIGNED_OUT' ? 'logout' as const :
                   event === 'TOKEN_REFRESHED' ? 'login' as const : 'login' as const,
            metadata: {
              userId: session.user.id,
              email: session.user.email,
              userType: session.user.user_metadata?.user_type,
              event: event
            }
          };
          
          // Run blockchain authentication in background (don't await)
          Promise.all([
            authenticateWithBlockchain(authEvent).catch(error => 
              console.warn('Blockchain authentication failed:', error)
            ),
            logAuditEvent({
              action: `auth_${event.toLowerCase()}`,
              resourceType: 'auth',
              resourceId: session.user.id,
              details: authEvent.metadata,
              severity: 'low'
            }).catch(error => 
              console.warn('Audit logging failed:', error)
            )
          ]).catch(() => {
            // Ignore errors to prevent blocking auth flow
          });
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, userType: 'institution' | 'student', additionalData?: any) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      console.log('Supabase signUp metadata:', { user_type: userType, ...additionalData });
      console.log('Additional data keys:', Object.keys(additionalData || {}));
      console.log('Name value:', additionalData?.name);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            user_type: userType,
            ...additionalData
          }
        }
      });

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      // Profile creation is now handled automatically by database trigger
      if (data.user && !error) {
        // Log successful signup attempt with enhanced blockchain logging (non-blocking)
        Promise.all([
          logAuditEvent({
            action: 'user_signup',
            resourceType: 'auth',
            resourceId: data.user.id,
            details: { 
              user_type: userType, 
              email,
              blockchain_enabled: isBlockchainEnabled,
              signup_method: 'email_password'
            },
            severity: 'low'
          }).catch(logError => 
            console.warn('Failed to log signup event:', logError)
          ),
          
          // Also authenticate with blockchain
          authenticateWithBlockchain({
            action: 'signup',
            metadata: {
              userId: data.user.id,
              email,
              userType,
              signupMethod: 'email_password'
            }
          }).catch(authError => 
            console.warn('Failed blockchain auth:', authError)
          )
        ]).catch(() => {
          // Ignore errors to prevent blocking signup flow
        });
        
        toast({
          title: "Sign Up Successful",
          description: "Please check your email to verify your account.",
        });
      }

      return { data, error: null };
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      // Log successful signin with blockchain (non-blocking)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          logAuditEvent({
            action: 'user_signin',
            resourceType: 'auth',
            resourceId: user.id,
            details: { 
              email,
              blockchain_enabled: isBlockchainEnabled,
              signin_method: 'email_password'
            },
            severity: 'low'
          }).catch(logError => 
            console.warn('Failed to log signin event:', logError)
          );
        }
      }).catch(() => {
        // Ignore errors to prevent blocking signin flow
      });
      
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Log signout before clearing session with blockchain (non-blocking)
      if (user) {
        logAuditEvent({
          action: 'user_signout',
          resourceType: 'auth',
          resourceId: user.id,
          details: { 
            email: user.email,
            blockchain_enabled: isBlockchainEnabled
          },
          severity: 'low'
        }).catch(logError => 
          console.warn('Failed to log signout event:', logError)
        );
      }
      
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      signUp,
      signIn,
      signOut,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};