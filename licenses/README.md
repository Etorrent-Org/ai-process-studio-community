# Licence APS

AI Process Studio Community fonctionne sans fichier de licence et active nativement les modules `core`, `discover` et `map`.

Une licence locale signée est uniquement nécessaire pour activer les modules Professional. La clé privée de signature n'est jamais distribuée dans le paquet client, dans l'image Docker ou dans ce dépôt.

Le paquet contient uniquement la clé publique Ed25519 nécessaire à la vérification locale.

Une licence Professional valide doit utiliser l'édition `Professional`, ne contenir que des identifiants de modules Professional connus, ne pas dupliquer de module et utiliser des dates cohérentes. La signature est vérifiée sur le payload canonique documenté dans `docs/LICENSING.md`.

En cas de licence absente, invalide ou expirée, l'application revient automatiquement aux droits Community.

La licence publique historique `APS-2026-V1-LOCAL` est obsolète depuis la version 1.1.0 et n'accorde plus de modules supplémentaires.
