const makers = [
  {
    name: "@electron-forge/maker-squirrel",
    config: {
      name: "clubpenguinatake",
      productName: "Club Penguin Atake App",
      authors: "One Live",
      loadingGif: "./src/assets/default-splash.gif",
      setupIcon: "./lib/icons/icon.ico",
    },
  },
  {
    name: "@electron-forge/maker-zip",
    platforms: ["darwin"],
  },
  {
    name: "@electron-forge/maker-dmg",
    platforms: ["darwin"],
    config: {
      name: "ClubPenguinAtake",
      title: "Club Penguin Atake App",
      icon: "./lib/icons/icon.icns",
      format: "ULFO",
      overwrite: true,
    },
  },
  {
    name: "@electron-forge/maker-deb",
    config: {
      options: {
        name: "clubpenguinatake",
        productName: "ClubPenguinAtake",
        genericName: "ClubPenguinAtake",
      },
    },
  },
  {
    name: "@electron-forge/maker-rpm",
    config: {},
  },
  {
    name: "@electron-forge/maker-flatpak",
    config: {
      genericName: "ClubPenguinAtake",
      productName: "ClubPenguinAtake",
      categories: ["Game"],
      modules: [
        {
          name: "zypak",
          sources: [
            {
              type: "git",
              url: "https://github.com/refi64/zypak",
              tag: "v2022.04",
            },
          ],
        },
      ],
      runtimeVersion: "22.08",
      baseVersion: "22.08",
      icon: "./lib/icons/icon.ico",
    },
  },
];

const installerIdentity = process.env.APPLE_INSTALLER_IDENTITY;

if (installerIdentity) {
  makers.push({
    name: "@electron-forge/maker-pkg",
    platforms: ["darwin"],
    config: {
      name: "ClubPenguinAtake",
      identity: installerIdentity,
      install: "/Applications",
    },
  });
}

module.exports = {
  packagerConfig: {
    icon: "lib/icons/icon.icns",
    name: "ClubPenguinAtake",
    executableName: "clubpenguinatake",
    platform: {
      linux: {
        name: "ClubPenguinAtake",
      },
    },
  },
  makers,
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "oneliveme",
          name: "cpatake_app",
        },
        prerelease: false,
      },
    },
  ],
};
