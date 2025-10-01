async function loadApp() {
    try {
        console.log('🔧 Loading application...');
        await import('./app.js');
        console.log('✅ Application loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load application:', error);
        process.exit(1);
    }
}

loadApp();