// index.js
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const mysql = require("mysql2/promise");
const config = require("./config.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const pool = mysql.createPool(config.database);

// Cek koneksi database saat startup
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    process.exit(1);
  }
  console.log("Successfully connected to the database.");
  connection.release();
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.application.commands.set([
    {
      name: "daftar",
      description: "Daftar UCP untuk game SAMP",
    },
    {
      name: "deleteucp",
      description: "Hapus UCP dari database",
    },
  ]);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "daftar") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("startRegistration")
        .setLabel("Mulai Pendaftaran")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("📝")
    );

    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("Pendaftaran UCP SAMP")
      .setDescription(
        "Selamat datang di proses pendaftaran UCP untuk server SAMP kami!"
      )
      .addFields(
        {
          name: "Langkah 1",
          value: 'Klik tombol "Mulai Pendaftaran" di bawah.',
        },
        {
          name: "Langkah 2",
          value: "Isi form yang muncul dengan UCP yang Anda inginkan.",
        },
        {
          name: "Langkah 3",
          value: "Tunggu konfirmasi pendaftaran dari sistem.",
        }
      )
      .setThumbnail(config.serverInfo.logo)
      .setFooter({
        text: `${config.serverInfo.serverName} - The Best SAMP Experience`,
      });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  } else if (interaction.commandName === "deleteucp") {
    await deleteUCP(interaction);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton() && interaction.customId === "startRegistration") {
    const modal = new ModalBuilder()
      .setCustomId("ucpRegistration")
      .setTitle("Pendaftaran UCP SAMP");

    const ucpInput = new TextInputBuilder()
      .setCustomId("ucpInput")
      .setLabel("Masukkan UCP yang diinginkan")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Contoh: Zee")
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(22);

    const firstActionRow = new ActionRowBuilder().addComponents(ucpInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
  }

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "ucpRegistration"
  ) {
    const ucp = interaction.fields.getTextInputValue("ucpInput");
    await registerUCP(interaction, ucp);
  }
});

async function registerUCP(interaction, ucp) {
  try {
    // Validasi input UCP
    if (!ucp || ucp.length < 3 || ucp.length > 22) {
      throw new Error("UCP harus memiliki panjang antara 3 dan 22 karakter.");
    }

    // Cek koneksi database
    await pool.query("SELECT 1");

    // Cek apakah pengguna sudah memiliki UCP
    const [existingUser] = await pool.query(
      "SELECT * FROM playerucp WHERE DiscordID = ?",
      [interaction.user.id]
    );
    if (existingUser.length > 0) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("Pendaftaran Gagal")
        .setDescription("Anda sudah memiliki UCP terdaftar.")
        .addFields({ name: "UCP Anda", value: existingUser[0].ucp })
        .setThumbnail(config.serverInfo.logo)
        .setFooter({
          text: `${config.serverInfo.serverName} - The Best SAMP Experience`,
        });

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Cek apakah UCP sudah digunakan
    const [existingUCP] = await pool.query(
      "SELECT * FROM playerucp WHERE ucp = ?",
      [ucp]
    );
    if (existingUCP.length > 0) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("Pendaftaran Gagal")
        .setDescription("UCP sudah terdaftar. Silakan pilih UCP lain.")
        .setThumbnail(config.serverInfo.logo)
        .setFooter({
          text: `${config.serverInfo.serverName} - The Best SAMP Experience`,
        });

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    const verifyCode = generateVerifyCode();

    // Coba kirim DM ke pengguna
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("🎉 Selamat Datang di Server Afterlife RP! 🎉")
        .setDescription(
          `Halo ${interaction.user.username}, selamat bergabung di komunitas kami! Berikut adalah informasi penting untuk Anda:`
        )
        .addFields(
          { name: "🆔 UCP Anda", value: ucp, inline: true },
          { name: "🔑 Kode UCP", value: verifyCode, inline: true },
          { name: "\u200B", value: "\u200B" },
          {
            name: "🚀 Langkah Selanjutnya",
            value:
              "1. Download SA-MP client\n2. Masuk ke server kami\n3. Gunakan kode verifikasi saat login pertama kali",
          },
          {
            name: "🌐 IP Server",
            value: `${config.serverInfo.ipAddress}:${config.serverInfo.port}`,
          }
        )
        .setThumbnail(config.serverInfo.logo)
        .setImage(config.serverInfo.bannerImage)
        .setFooter({
          text: `${config.serverInfo.serverName} - The Best SAMP Experience`,
        });

      const dmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Panduan Pemula")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/2G6dCEva"),
        new ButtonBuilder()
          .setLabel("Discord Community")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/wg3F2C34")
      );

      await interaction.user.send({ embeds: [dmEmbed], components: [dmRow] });

      // Jika DM berhasil dikirim, masukkan ke database
      await pool.query(
        "INSERT INTO playerucp (ucp, DiscordID, verifyCode) VALUES (?, ?, ?)",
        [ucp, interaction.user.id, verifyCode]
      );

      const successEmbed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("Pendaftaran UCP Berhasil")
        .setDescription(
          "Silakan cek pesan langsung dari bot untuk informasi lebih lanjut."
        )
        .setThumbnail(config.serverInfo.logo)
        .setFooter({
          text: `${config.serverInfo.serverName} - The Best SAMP Experience`,
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Cek Pesan Langsung")
          .setStyle(ButtonStyle.Link)
          .setURL(
            `https://discord.com/channels/@me/${interaction.user.dmChannel.id}`
          )
          .setEmoji("📩")
      );

      await interaction.reply({
        embeds: [successEmbed],
        components: [row],
        ephemeral: true,
      });
    } catch (dmError) {
      console.error("Failed to send DM:", dmError);
      throw new Error(
        "Tidak dapat mengirim pesan langsung. Periksa pengaturan privasi Anda."
      );
    }
  } catch (error) {
    console.error("Error registering UCP:", error);

    let errorMessage = "Terjadi kesalahan saat mendaftarkan UCP. ";
    if (error.message.includes("UCP harus memiliki")) {
      errorMessage += error.message;
    } else if (error.message.includes("Tidak dapat mengirim pesan langsung")) {
      errorMessage += error.message;
    } else {
      errorMessage += "Silakan coba lagi nanti.";
    }

    const errorEmbed = new EmbedBuilder()
      .setColor("#FF0000")
      .setTitle("Pendaftaran Gagal")
      .setDescription(errorMessage)
      .setThumbnail(config.serverInfo.logo)
      .setFooter({
        text: `${config.serverInfo.serverName} - The Best SAMP Experience`,
      });

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function deleteUCP(interaction) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM playerucp WHERE DiscordID = ?",
      [interaction.user.id]
    );
    if (rows.length === 0) {
      const noUCPEmbed = new EmbedBuilder()
        .setColor("#FFA500")
        .setTitle("UCP Tidak Ditemukan")
        .setDescription("Anda tidak memiliki UCP yang terdaftar.")
        .setThumbnail(config.serverInfo.logo)
        .setFooter({
          text: `${config.serverInfo.serverName} - The Best SAMP Experience`,
        });

      await interaction.reply({ embeds: [noUCPEmbed], ephemeral: true });
      return;
    }

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirmDelete")
        .setLabel("Ya, Hapus UCP")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancelDelete")
        .setLabel("Batal")
        .setStyle(ButtonStyle.Secondary)
    );

    const confirmEmbed = new EmbedBuilder()
      .setColor("#FFA500")
      .setTitle("Konfirmasi Penghapusan UCP")
      .setDescription(
        `Anda akan menghapus UCP: ${rows[0].ucp}. Apakah Anda yakin?`
      )
      .setThumbnail(config.serverInfo.logo)
      .setFooter({
        text: `${config.serverInfo.serverName} - The Best SAMP Experience`,
      });

    const response = await interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmRow],
      ephemeral: true,
    });

    const collectorFilter = (i) => i.user.id === interaction.user.id;
    try {
      const confirmation = await response.awaitMessageComponent({
        filter: collectorFilter,
        time: 60000,
      });

      if (confirmation.customId === "confirmDelete") {
        await pool.query("DELETE FROM playerucp WHERE DiscordID = ?", [
          interaction.user.id,
        ]);

        const deleteSuccessEmbed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle("Penghapusan UCP Berhasil")
          .setDescription(
            `UCP Anda (${rows[0].ucp}) telah berhasil dihapus dari database.`
          )
          .addFields({ name: "UCP", value: rows[0].ucp, inline: true })
          .setThumbnail(config.serverInfo.logo)
          .setFooter({
            text: `${config.serverInfo.serverName} - The Best SAMP Experience`,
          });

        await confirmation.update({
          embeds: [deleteSuccessEmbed],
          components: [],
        });
      } else {
        await confirmation.update({
          content: "Penghapusan UCP dibatalkan.",
          embeds: [],
          components: [],
        });
      }
    } catch (e) {
      await interaction.editReply({
        content: "Tidak ada respon. Penghapusan UCP dibatalkan.",
        embeds: [],
        components: [],
      });
    }
  } catch (error) {
    console.error("Error deleting UCP:", error);
    await interaction.reply({
      content: "Terjadi kesalahan saat menghapus UCP. Silakan coba lagi nanti.",
      ephemeral: true,
    });
  }
}

function generateVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

client.login(config.token);
