
import React, { useState } from 'react';
import { FeedbackIcon, StarIcon, CheckCircleIcon, LoadingIcon } from './icons';

const Feedback: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleOpen = () => {
        setIsOpen(true);
        // Reset state when opening
        setIsSubmitted(false);
        setRating(0);
        setHoverRating(0);
        setComment('');
    };

    const handleClose = () => setIsOpen(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0 && !comment.trim()) {
            return;
        }

        setIsSubmitting(true);
        
        // In a real app, you would send this to a server.
        // For this demo, we'll just log it and simulate a network request.
        console.log("Feedback Submitted:", { rating, comment });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIsSubmitting(false);
        setIsSubmitted(true);

        // Close modal after a short delay to show the success message
        setTimeout(() => {
            handleClose();
        }, 2000);
    };
    
    return (
        <>
            <button
                onClick={handleOpen}
                className="fixed bottom-6 right-6 p-3 bg-brand-accent text-white rounded-full shadow-lg hover:bg-brand-accent-hover transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent z-40"
                aria-label="Send Feedback"
            >
                <FeedbackIcon className="w-6 h-6" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-brand-surface rounded-xl shadow-2xl w-full max-w-md flex flex-col relative animate-fade-in-up">
                        <header className="p-4 border-b border-brand-border flex justify-between items-center">
                            <h2 className="text-xl font-bold text-brand-text-primary">Provide Feedback</h2>
                            <button onClick={handleClose} disabled={isSubmitting} className="p-2 rounded-full hover:bg-brand-secondary disabled:opacity-50 text-2xl leading-none">&times;</button>
                        </header>
                        
                        {isSubmitted ? (
                            <div className="p-8 text-center flex flex-col items-center">
                                <CheckCircleIcon className="w-12 h-12 text-green-500 mb-4" />
                                <h3 className="text-lg font-semibold text-brand-text-primary">Thank you!</h3>
                                <p className="text-brand-text-secondary mt-2">Your feedback helps us improve.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <main className="p-6 space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-brand-text-primary mb-2">How would you rate Hippocrates's responses?</label>
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onMouseEnter={() => setHoverRating(star)}
                                                    onMouseLeave={() => setHoverRating(0)}
                                                    onClick={() => setRating(star)}
                                                    className="focus:outline-none"
                                                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                                >
                                                    <StarIcon className={`w-8 h-8 transition-colors cursor-pointer ${
                                                        (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-brand-border'
                                                    }`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="feedback-comment" className="block text-sm font-medium text-brand-text-primary mb-2">
                                            Comments & Suggestions
                                        </label>
                                        <textarea
                                            id="feedback-comment"
                                            rows={5}
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            placeholder="What went well? What could be improved?"
                                            className="w-full p-2 border border-brand-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-accent resize-y"
                                        />
                                    </div>
                                </main>
                                <footer className="p-4 bg-brand-secondary/50 border-t border-brand-border flex justify-end">
                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting || (rating === 0 && !comment.trim())}
                                        className="px-5 py-2 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-accent-hover transition-colors flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting && <LoadingIcon className="w-5 h-5" />}
                                        {isSubmitting ? 'Sending...' : 'Send Feedback'}
                                    </button>
                                </footer>
                            </form>
                        )}
                    </div>
                    <style>{`
                        @keyframes fade-in-up {
                            0% { opacity: 0; transform: translateY(20px); }
                            100% { opacity: 1; transform: translateY(0); }
                        }
                        .animate-fade-in-up {
                            animation: fade-in-up 0.3s ease-out forwards;
                        }
                    `}</style>
                </div>
            )}
        </>
    );
};

export default Feedback;