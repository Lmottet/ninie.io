import { sendMessage } from "../../deps.ts";
import { botCache } from "../../mod.ts";
import { Embed } from "../utils/Embed.ts";
import { sendEmbed } from "../utils/helpers.ts";
import { Message } from "../../deps.ts";

botCache.commands.set("help", {
  name: `help`,
  execute: (message: Message) => {
    sendEmbed(message.channelID, useful());
    sendEmbed(message.channelID, randoms());
    sendEmbed(message.channelID, io());
    sendMessage(
      message.channelID,
      "Et en bonus: la commande mystère ! Bonne recherche :)",
    );
  },
});

const randoms = () =>
  new Embed()
    .setDescription(`Des commandes au pif`)
    .addField("avatar, gm, meow, sing", "no args");

const io = () =>
  new Embed()
    .setDescription(`Des commandes liées au score de Ninie.io`)
    .addField("harem, score", "no args")
    .addField("hate, love", `args: @user number`)
    .addField("office", "alias: slurp, bureau");

const useful = () =>
  new Embed()
    .setDescription(`Des commandes utiles`)
    .addField("rio", `args: realm/name`)
    .addField("help, corruption, macro", "no args")
    .addField(
      "druid, priest, monk, paladin, war, hunter, mage, warlock, rogue, dk, dh",
      "no args - alias en français & diminutifs courant (druide, démo etc.)",
    );
