import React, { useState, useEffect } from 'react';
import { useAuth, db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, MessageSquare, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Post {
  id: string;
  authorId: string;
  content: string;
  postType: string;
  createdAt: any;
  authorName?: string;
  commentCount?: number;
}

export default function Community() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('discussion');
  const [search, setSearch] = useState('');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const toggleComments = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    
    setExpandedPostId(postId);
    setCommentText('');
    
    if (!comments[postId]) {
      setLoadingComments(true);
      try {
        const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        const fetchedComments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Fetch author names for comments
        for (let c of fetchedComments) {
          try {
            const userDoc = await getDoc(doc(db, 'users', c.authorId));
            if (userDoc.exists()) {
               c.authorName = userDoc.data().fullName;
            }
          } catch(e) {}
        }
        
        setComments(prev => ({ ...prev, [postId]: fetchedComments }));
      } catch (error) {
        console.error("Error fetching comments", error);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handlePostComment = async (postId: string) => {
    if (!user) {
      toast.error("Please sign in to comment");
      return;
    }
    if (!commentText.trim()) return;

    try {
      const commentRef = await addDoc(collection(db, `posts/${postId}/comments`), {
        postId,
        authorId: user.uid,
        content: commentText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const newComment = {
        id: commentRef.id,
        postId,
        authorId: user.uid,
        content: commentText,
        authorName: user.displayName || 'Me', // We don't have it on user object easily if it hasn't loaded, let's just use 'Me' or re-fetch posts.
        createdAt: { toDate: () => new Date() }
      };
      
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }));
      setCommentText('');
      toast.success("Comment added!");
    } catch (error) {
      toast.error("Failed to add comment");
      console.error(error);
    }
  };

  const fetchPosts = async () => {
    try {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const rawPosts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      
      // Fetch author names
      for (let post of rawPosts) {
        try {
          const userDoc = await getDoc(doc(db, 'users', post.authorId));
          if (userDoc.exists()) post.authorName = userDoc.data().fullName;
        } catch(e) {}
      }
      setPosts(rawPosts);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to post");
      return;
    }
    if (!content.trim()) return;

    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        content,
        postType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Post published!");
      setContent('');
      fetchPosts();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
      toast.error("Failed to publish post");
    }
  };

  const filteredPosts = posts
    .map(p => {
      let score = 0;
      const loweredSearch = search.toLowerCase().trim();
      const searchTerms = loweredSearch.split(/\s+/).filter(t => t.trim() !== '');
      
      const pContent = (p.content || '').toLowerCase();
      const pAuthor = (p.authorName || '').toLowerCase();
      const pType = p.postType.toLowerCase().replace('_', ' ');
      
      if (searchTerms.length === 0) {
        score = 1; // Default everything to match if no search
      } else {
        let allTermsMatched = true;
        for (const term of searchTerms) {
          const matchInContent = pContent.includes(term);
          const matchInAuthor = pAuthor.includes(term);
          const matchInType = pType.includes(term);
          
          if (!matchInContent && !matchInAuthor && !matchInType) {
            allTermsMatched = false;
            break;
          }
          if (matchInContent) score += 3;
          if (matchInAuthor) score += 2;
          if (matchInType) score += 1;
        }
        
        if (!allTermsMatched) score = 0;
      }
      
      return { ...p, score };
    })
    .filter(p => p.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      // Secondary sort by date
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 -ml-4 text-slate-600">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pet Community</h1>
          <p className="text-slate-500 mt-1">Ask questions, share advice, and connect with pet lovers in Laoag City.</p>
        </div>
        <Input 
          placeholder="Search discussions..." 
          className="w-full sm:w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="mb-10 shadow-sm border-slate-200">
        <CardContent className="pt-6">
          <form onSubmit={handlePost}>
            <div className="mb-4">
              <Textarea 
                placeholder={user ? "What's on your mind? Share a tip or ask a question..." : "Sign in to join the discussion"}
                className="resize-none h-24"
                value={content}
                onChange={e => setContent(e.target.value)}
                disabled={!user}
              />
            </div>
            <div className="flex justify-between items-center">
              <Select value={postType} onValueChange={setPostType} disabled={!user}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discussion">General Discussion</SelectItem>
                  <SelectItem value="health_advice">Health Advice</SelectItem>
                  <SelectItem value="training">Training Tips</SelectItem>
                  <SelectItem value="lost_found">Lost & Found</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={!user || !content.trim()}>Post</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 mb-4">{search ? 'No posts found matching your search.' : 'No posts yet. Be the first to start a conversation!'}</p>
          {!user && !search && <Button onClick={() => navigate('/login')}>Sign in to participate</Button>}
          {search && <Button variant="outline" onClick={() => setSearch('')}>Clear search</Button>}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPosts.map(post => (
            <Card key={post.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="w-10 h-10 border border-slate-200">
                    <AvatarFallback className="bg-indigo-50 text-indigo-700 font-semibold text-sm">
                      {post.authorName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-semibold text-slate-900">{post.authorName || 'Anonymous Owner'}</span>
                        <span className="text-slate-400 text-sm ml-2">
                          {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                        </span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-full capitalize">
                        {post.postType.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap mt-2">{post.content}</p>
                    
                    <div className="mt-4 flex gap-4">
                      <Button variant="ghost" size="sm" className="text-slate-500 gap-1 h-8 px-2" onClick={() => toggleComments(post.id)}>
                        <MessageSquare className="w-4 h-4" /> 
                        <span className="text-xs">{expandedPostId === post.id ? 'Close Comments' : 'Comment'}</span>
                      </Button>
                    </div>

                    {expandedPostId === post.id && (
                      <div className="mt-6 border-t border-slate-100 pt-4">
                        {loadingComments ? (
                          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                        ) : (
                          <div className="space-y-4 mb-4">
                            {comments[post.id]?.length === 0 ? (
                              <p className="text-sm text-slate-500 text-center py-2">No comments yet. Be the first to reply!</p>
                            ) : (
                              comments[post.id]?.map(comment => (
                                <div key={comment.id} className="flex gap-3">
                                  <Avatar className="w-8 h-8 border border-slate-200">
                                    <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">
                                      {comment.authorName?.[0]?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 bg-slate-50 rounded-lg p-3 text-sm">
                                    <div className="font-semibold text-slate-900 mb-1">{comment.authorName || 'Anonymous Owner'}</div>
                                    <p className="text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        
                        {user ? (
                          <div className="flex gap-3 mt-4">
                            <Avatar className="w-8 h-8 border border-slate-200">
                              <AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs">
                                {user.displayName?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 flex gap-2">
                              <Input 
                                placeholder="Write a comment..." 
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                className="h-9"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handlePostComment(post.id);
                                  }
                                }}
                              />
                              <Button size="sm" className="h-9 px-3" onClick={() => handlePostComment(post.id)} disabled={!commentText.trim()}>Post</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 text-center">
                            <span className="text-sm text-slate-500 mr-2">Sign in to leave a comment</span>
                            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>Login</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
