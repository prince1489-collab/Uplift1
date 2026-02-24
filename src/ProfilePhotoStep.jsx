import React, { useState } from 'react';

const ProfilePhotoStep = () => {
    const [photo, setPhoto] = useState(null);

    const handlePhotoChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setPhoto(URL.createObjectURL(file));
        }
    };

    return (
        <div>
            <h2>Upload Profile Photo</h2>
            <input type="file" onChange={handlePhotoChange} accept="image/*" />
            {photo && <img src={photo} alt="Profile Preview" style={{ width: '200px', height: '200px' }} />}
        </div>
    );
};

export default ProfilePhotoStep;
