import { config } from "../../config.ts";
import { Message } from "../../deps.ts";
import { botCache } from "../../mod.ts";
import { addLove, getLove } from "../services/feelsService.ts";
import { Embed } from "../utils/Embed.ts";
import { createCommandAliases, sendEmbed } from "../utils/helpers.ts";

botCache.commands.set(`office`, {
  name: `office`,
  description: "Bend the knee.",
  // adds cooldowns to the command
  cooldown: {
    // usages in certain duration of seconds below
    allowedUses: 1,
    // the cooldown
    seconds: config.officeCooldown,
  },
  // Prevents it from being used in dms
  guildOnly: true,
  execute: function (message: Message) {
    addLove(message.author.id, config.officeLove);
    sendEmbed(
      message.channelID,
      embed(message),
      `<@!353512918379397130> vient de passer un bon moment !`,
    );
  },
});

createCommandAliases("office", ["bureau", "slurp"]);

const embed = (message: Message) =>
  new Embed()
    .setDescription(
      `Gain de ${config.officeLove} points de Ninie.io pour un passage sale au bureau !`,
    )
    .addField("Poulain :", `${message.author.username}`)
    .addField(
      "Heure de la gâterie :",
      `Le ${new Date(message.timestamp).toLocaleDateString()} à ${
        new Date(message.timestamp).toLocaleTimeString("Europe/Bruxelles")
      }`,
    )
    .addField("Nouveau Ninie.io :", getLove(message.author.id));
