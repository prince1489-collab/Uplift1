import React, { useState } from 'react';

const App = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        profilePhoto: null,
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleFileChange = (e) => {
        setFormData({ ...formData, profilePhoto: e.target.files[0] });
    };

    const nextStep = () => {
        setStep(step + 1);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle submission logic here
        console.log(formData);
    };

    return (
        <div className="app">
            <h1>Onboarding Flow</h1>
            {step === 1 && (
                <div>
                    <h2>Sign In</h2>
                    <form onSubmit={handleSubmit}>
                        <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="Email" required />
                        <input type="password" name="password" value={formData.password} onChange={handleInputChange} placeholder="Password" required />
                        <button type="submit">Sign In</button>
                    </form>
                    <button onClick={nextStep}>Continue as New User</button>
                </div>
            )}
            {step === 2 && (
                <div>
                    <h2>New User Details</h2>
                    <form onSubmit={handleSubmit}>
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Your Name" required />
                        <input type="file" onChange={handleFileChange} accept="image/*" />
                        <button type="submit">Submit</button>
                    </form>
                </div>
            )}
            {step > 2 && (<h2>Welcome to the Application!</h2>)}
        </div>
    );
};

export default App;