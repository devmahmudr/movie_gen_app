// Dynamic app config to support EAS environment variables
export default ({ config }) => {
    return {
        ...config,
        name: "Movie App",
        slug: "movie-app",
        version: "1.0.0",
        orientation: "portrait",
        userInterfaceStyle: "dark",
        splash: {
            resizeMode: "contain",
            backgroundColor: "#000000"
        },
        assetBundlePatterns: ["**/*"],
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.movieapp"
        },
        android: {
            adaptiveIcon: {
                backgroundColor: "#000000"
            },
            package: "com.movieapp"
        },
        scheme: "movieapp",
        plugins: ["expo-router"],
        extra: {
            // API URL from environment variable (set in eas.json)
            apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://moviegenapp-production.up.railway.app",
            router: {},
            eas: {
                projectId: "1d0e3bbd-6e43-46fb-9b3f-a9d10380a220"
            }
        },
        runtimeVersion: {
            policy: "appVersion"
        },
        updates: {
            url: "https://u.expo.dev/1d0e3bbd-6e43-46fb-9b3f-a9d10380a220"
        }
    };
};
