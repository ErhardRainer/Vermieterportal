winget source update
winget search --source winget php

# Neueste 8.4, Non-Thread-Safe (empfohlen)
winget install --source winget --id PHP.PHP.NTS.8.4 -e

# zeigt alle PHP-Installationen (falls mehrere)
winget list php