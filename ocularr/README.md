Ocularr - Self-Hosted Movie Club Application

A comprehensive movie club platform that allows friends to participate in structured movie cycles with themes, nominations, rankings, and points systems.
Features

    Multi-club support: Create and join multiple movie clubs
    5-phase movie cycles: Nomination → Watching → Ranking → Results
    Role-based permissions: Critics, Directors, Producers
    Theme pool system: Community-submitted movie themes
    Points & rankings: Sophisticated scoring based on peer rankings
    Annual seasons: Leaderboards and awards
    TMDB integration: Real movie search and data
    Personal profiles: Favorite movies and watchlists
    Mobile responsive: Works on all devices

Quick Setup

    Get TMDB API Key: Register at themoviedb.org and get a free API key
    Configure Environment: Edit .env file and replace YOUR_TMDB_API_KEY_HERE with your actual API key
    Deploy: Run docker-compose up -d
    Access: Open browser to http://your-nas-ip:5000

Requirements

    Docker and Docker Compose
    TMDB API key (free)
    2GB+ available RAM
    5GB+ available storage

Movie Cycle Workflow

    Idle: Club awaits next cycle
    Nomination: Random theme selected, members nominate movies
    Watching: Members watch all nominated movies
    Ranking: Members guess nominations and rank movies
    Results: Points calculated, winner announced

User Roles

    Critics: Regular members who participate in cycles
    Directors: Can manage cycles and moderate themes
    Producers: Club owners with full administrative control

Support

For issues or questions, check the documentation or create an issue in the project repository.
